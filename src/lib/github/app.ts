// GitHub App install, repo→team maps, and webhook handling (T-44).
import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import type { Db, Row } from "../db";
import { audit, newId } from "../data";
import { now } from "../clock";
import { encryptSecret } from "../crypto/secrets";
import { ingestPullRequest, scrub } from "../sources";
import { learnQuietly } from "../context-learn";

export function githubAppConfigured(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return !!(env.GITHUB_APP_ID?.trim() && env.GITHUB_APP_PRIVATE_KEY?.trim());
}

export function githubAppInstallUrl(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  state?: string,
): string | null {
  const slug = env.GITHUB_APP_SLUG?.trim();
  if (!slug) return null;
  const u = new URL(`https://github.com/apps/${slug}/installations/new`);
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Prefer the App webhook secret; fall back to the legacy per-repo secret. Fail closed in production. */
export function verifyGithubAppSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() || process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) return !isProd(); // local/demo only
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Short-lived JWT for GitHub App API calls (RS256). */
export function createGithubAppJwt(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const appId = env.GITHUB_APP_ID?.trim();
  const pem = env.GITHUB_APP_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!appId || !pem) throw new Error("GitHub App is not configured");
  const nowSec = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: nowSec - 60, exp: nowSec + 9 * 60, iss: appId }));
  const data = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(data);
  sign.end();
  return `${data}.${sign.sign(pem, "base64url")}`;
}

export async function fetchGithubInstallation(installationId: string): Promise<{
  id: string;
  accountLogin: string;
  repos: string[];
}> {
  const jwt = createGithubAppJwt();
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Beacon-GitHub-App",
    },
  });
  if (!res.ok) throw new Error(`GitHub installation ${installationId} not found (${res.status})`);
  const body = (await res.json()) as Row;
  const accountLogin = String((body.account as Row)?.login ?? "");
  if (!accountLogin) throw new Error("GitHub installation has no account");

  // Installation token → list repos the App can see.
  const tokRes = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Beacon-GitHub-App",
    },
  });
  if (!tokRes.ok) throw new Error("Could not mint a GitHub installation token");
  const tokBody = (await tokRes.json()) as Row;
  const token = String(tokBody.token ?? "");
  const repos: string[] = [];
  let page = 1;
  while (page <= 5 && token) {
    const list = await fetch(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Beacon-GitHub-App",
      },
    });
    if (!list.ok) break;
    const data = (await list.json()) as { repositories?: Row[] };
    for (const r of data.repositories ?? []) {
      const name = String(r.full_name ?? "").toLowerCase();
      if (name) repos.push(name);
    }
    if ((data.repositories?.length ?? 0) < 100) break;
    page++;
  }
  return { id: String(body.id ?? installationId), accountLogin, repos };
}

async function replaceInstallationRepos(db: Db, installationId: string, repos: string[]) {
  await db.query(`delete from github_installation_repo where installation_id = $1`, [installationId]);
  for (const repo of repos) {
    const name = repo.trim().toLowerCase();
    if (!name) continue;
    await db.query(`insert into github_installation_repo (installation_id, repo_full_name) values ($1, $2) on conflict do nothing`, [
      installationId,
      name,
    ]);
  }
}

export async function addInstallationRepos(db: Db, installationId: string, repos: string[]) {
  for (const repo of repos) {
    const name = repo.trim().toLowerCase();
    if (!name) continue;
    await db.query(`insert into github_installation_repo (installation_id, repo_full_name) values ($1, $2) on conflict do nothing`, [
      installationId,
      name,
    ]);
  }
}

export async function removeInstallationRepos(db: Db, installationId: string, repos: string[]) {
  for (const repo of repos) {
    const name = repo.trim().toLowerCase();
    if (!name) continue;
    await db.query(`delete from github_installation_repo where installation_id = $1 and repo_full_name = $2`, [
      installationId,
      name,
    ]);
  }
}

/**
 * Attach a GitHub App installation to a workspace. Never reassigns an install owned by another org.
 * Pass `repos` from a verified GitHub API call or from tests; required for mapping.
 */
export async function recordInstallation(
  db: Db,
  input: {
    orgId: string;
    installationId: string | number;
    accountLogin: string;
    installedByAccountId?: string | null;
    accessToken?: string | null;
    repos?: string[];
  },
): Promise<Row> {
  const installationId = String(input.installationId);
  const existing = await db.one(`select * from github_installation where installation_id = $1`, [installationId]);
  if (existing && existing.org_id !== input.orgId) {
    throw new Error("That GitHub App installation is already attached to another workspace");
  }
  const encrypted = input.accessToken ? encryptSecret(input.accessToken) : null;
  if (existing) {
    await db.query(
      `update github_installation set account_login = $2, encrypted_token = coalesce($3, encrypted_token) where installation_id = $1`,
      [installationId, input.accountLogin, encrypted],
    );
  } else {
    await db.query(
      `insert into github_installation (id, org_id, installation_id, account_login, encrypted_token, installed_by) values ($1, $2, $3, $4, $5, $6)`,
      [newId("ghi"), input.orgId, installationId, input.accountLogin, encrypted, input.installedByAccountId ?? null],
    );
  }
  if (input.repos) await replaceInstallationRepos(db, installationId, input.repos);
  await audit(db, {
    orgId: input.orgId,
    actorId: input.installedByAccountId ?? null,
    action: "github_app_install",
    targetKind: "github_installation",
    targetId: installationId,
    detail: { account: input.accountLogin, repos: input.repos?.length ?? null },
  });
  return (await db.one(`select * from github_installation where installation_id = $1`, [installationId]))!;
}

/** Verify the installation with the App JWT, then attach it to this workspace. */
export async function attachVerifiedInstallation(
  db: Db,
  input: { orgId: string; installationId: string; installedByAccountId?: string | null },
): Promise<Row> {
  if (!githubAppConfigured()) throw new Error("GitHub App credentials are not configured on this server");
  const remote = await fetchGithubInstallation(input.installationId);
  return recordInstallation(db, {
    orgId: input.orgId,
    installationId: remote.id,
    accountLogin: remote.accountLogin,
    installedByAccountId: input.installedByAccountId,
    repos: remote.repos,
  });
}

/** Map a repository to a team. The repo must belong to this workspace's installation. */
export async function mapRepoToTeam(
  db: Db,
  input: { orgId: string; installationId: string; repoFullName: string; unitId: string; actorId?: string | null },
): Promise<Row> {
  const repo = input.repoFullName.trim().toLowerCase();
  const unit = await db.one(`select id, name, org_id from unit where id = $1 and org_id = $2`, [input.unitId, input.orgId]);
  if (!unit) throw new Error("Team not found in this workspace");
  const install = await db.one(`select * from github_installation where installation_id = $1 and org_id = $2`, [
    input.installationId,
    input.orgId,
  ]);
  if (!install) throw new Error("GitHub App is not installed on this workspace");

  const allowed = await db.one(
    `select 1 from github_installation_repo where installation_id = $1 and repo_full_name = $2`,
    [input.installationId, repo],
  );
  if (!allowed) throw new Error(`Repository ${repo} is not on this GitHub App installation`);

  const existing = await db.one(
    `select * from github_repo_map where org_id = $1 and installation_id = $2 and lower(repo_full_name) = $3`,
    [input.orgId, input.installationId, repo],
  );
  if (existing) {
    await db.query(`update github_repo_map set unit_id = $2 where id = $1`, [existing.id, input.unitId]);
  } else {
    await db.query(
      `insert into github_repo_map (id, org_id, installation_id, repo_full_name, unit_id) values ($1, $2, $3, $4, $5)`,
      [newId("ghr"), input.orgId, input.installationId, repo, input.unitId],
    );
  }

  const conn = await db.one(`select * from connector where unit_id = $1 and kind = 'github' limit 1`, [input.unitId]);
  if (conn) {
    await db.query(`update connector set mode = 'live', name = $2, last_sync_at = $3 where id = $1`, [
      conn.id,
      input.repoFullName,
      now().toISOString(),
    ]);
  } else {
    await db.query(
      `insert into connector (id, org_id, unit_id, kind, name, status, mode, connected_by, last_sync_at, created_at)
       values ($1, $2, $3, 'github', $4, 'connected', 'live', null, $5, $5)`,
      [newId("cn"), input.orgId, input.unitId, input.repoFullName, now().toISOString()],
    );
  }

  await audit(db, {
    orgId: input.orgId,
    actorId: input.actorId ?? null,
    action: "github_repo_map",
    targetKind: "unit",
    targetId: input.unitId,
    detail: { repo, installationId: input.installationId },
  });
  return (await db.one(
    `select * from github_repo_map where org_id = $1 and installation_id = $2 and lower(repo_full_name) = $3`,
    [input.orgId, input.installationId, repo],
  ))!;
}

/** Resolve the mapped team from installation id + repository (never by repo name alone). */
export async function unitForRepo(db: Db, installationId: string | number | null | undefined, repoFullName: string): Promise<Row | null> {
  if (installationId == null || installationId === "") return null;
  return db.one(
    `select * from github_repo_map where installation_id = $1 and lower(repo_full_name) = $2`,
    [String(installationId), repoFullName.trim().toLowerCase()],
  );
}

function reposFromPayload(payload: Row): { added: string[]; removed: string[]; all: string[] } {
  const names = (rows: unknown) =>
    (Array.isArray(rows) ? rows : []).map((r) => String((r as Row)?.full_name ?? "").toLowerCase()).filter(Boolean);
  return {
    added: names(payload.repositories_added ?? payload.repositories),
    removed: names(payload.repositories_removed),
    all: names(payload.repositories),
  };
}

/**
 * Handle App webhook events. installation → update repos; pull_request (merged) → map then ingest;
 * pull_request_review (submitted) → learnFrom only when the reviewer is on the mapped team.
 */
export async function handleGithubAppEvent(
  db: Db,
  event: string | null,
  payload: Row,
): Promise<Record<string, unknown>> {
  if (event === "ping") return { ok: true };

  if (event === "installation" || event === "installation_repositories") {
    const installation = payload.installation as Row | undefined;
    if (!installation?.id) return { skipped: "no installation" };
    const installationId = String(installation.id);
    const existing = await db.one(`select * from github_installation where installation_id = $1`, [installationId]);
    if (!existing) return { skipped: "install from Beacon Connect to attach a workspace" };
    const login = String((installation.account as Row)?.login ?? existing.account_login);
    await db.query(`update github_installation set account_login = $2 where installation_id = $1`, [installationId, login]);
    const { added, removed, all } = reposFromPayload(payload);
    if (event === "installation" && all.length) await replaceInstallationRepos(db, installationId, all);
    else {
      if (added.length) await addInstallationRepos(db, installationId, added);
      if (removed.length) await removeInstallationRepos(db, installationId, removed);
    }
    return { updated: existing.id, reposAdded: added.length, reposRemoved: removed.length };
  }

  const installationId = (payload.installation as Row | undefined)?.id;

  if (event === "pull_request") {
    const repo = String((payload.repository as Row)?.full_name ?? "");
    const mapped = repo ? await unitForRepo(db, installationId, repo) : null;
    const result = await ingestPullRequest(db, payload, mapped?.unit_id ? { learnUnitId: String(mapped.unit_id) } : undefined);
    return result;
  }

  if (event === "pull_request_review") {
    const action = String(payload.action ?? "");
    if (action !== "submitted") return { skipped: `ignored review ${action}` };
    const review = payload.review as Row | undefined;
    const pr = payload.pull_request as Row | undefined;
    const repo = String((payload.repository as Row)?.full_name ?? "");
    const mapped = repo ? await unitForRepo(db, installationId, repo) : null;
    if (!mapped) return { skipped: `no team mapped for ${repo}` };
    const reviewerLogin = String((review?.user as Row | undefined)?.login ?? "").toLowerCase();
    if (!reviewerLogin) return { skipped: "review has no author" };
    const onTeam = await db.one(
      `select u.id from app_user u
       join member m on m.user_id = u.id
       where m.unit_id = $1 and lower(u.github_login) = $2 and u.kind = 'human'`,
      [mapped.unit_id, reviewerLogin],
    );
    if (!onTeam) return { skipped: `reviewer ${reviewerLogin} is not on the mapped team` };
    const body = scrub(String(review?.body ?? "")).trim();
    const title = scrub(String(pr?.title ?? `PR #${pr?.number ?? "?"}`));
    const text = body || `Reviewed ${title} (${review?.state ?? "commented"})`;
    await learnQuietly(db, {
      unitId: mapped.unit_id,
      kind: "pr",
      ref: `${repo}#${pr?.number}-review-${review?.id ?? "x"}`,
      label: `Review on PR #${pr?.number} in ${repo}`,
      repo,
      text,
      actorId: onTeam.id as string,
    });
    return { learned: true, unitId: mapped.unit_id };
  }

  return { skipped: event ? `ignored ${event}` : "no event" };
}
