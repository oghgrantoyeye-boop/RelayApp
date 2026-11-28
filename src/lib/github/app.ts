// GitHub App install, repo→team maps, and webhook handling (T-44).
import { createHmac, timingSafeEqual } from "node:crypto";
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
): string | null {
  const slug = env.GITHUB_APP_SLUG?.trim();
  if (!slug) return null;
  return `https://github.com/apps/${slug}/installations/new`;
}

/** Prefer the App webhook secret; fall back to the legacy per-repo secret. */
export function verifyGithubAppSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() || process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // local/demo
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export async function recordInstallation(
  db: Db,
  input: {
    orgId: string;
    installationId: string | number;
    accountLogin: string;
    installedByAccountId?: string | null;
    accessToken?: string | null;
  },
): Promise<Row> {
  const installationId = String(input.installationId);
  const existing = await db.one(`select * from github_installation where installation_id = $1`, [installationId]);
  const encrypted = input.accessToken ? encryptSecret(input.accessToken) : null;
  if (existing) {
    await db.query(
      `update github_installation set account_login = $2, encrypted_token = coalesce($3, encrypted_token), org_id = $4 where installation_id = $1`,
      [installationId, input.accountLogin, encrypted, input.orgId],
    );
  } else {
    await db.query(
      `insert into github_installation (id, org_id, installation_id, account_login, encrypted_token, installed_by) values ($1, $2, $3, $4, $5, $6)`,
      [newId("ghi"), input.orgId, installationId, input.accountLogin, encrypted, input.installedByAccountId ?? null],
    );
  }
  await audit(db, {
    orgId: input.orgId,
    actorId: input.installedByAccountId ?? null,
    action: "github_app_install",
    targetKind: "github_installation",
    targetId: installationId,
    detail: { account: input.accountLogin },
  });
  return (await db.one(`select * from github_installation where installation_id = $1`, [installationId]))!;
}

/** Map a repository to a team and mark/create a live GitHub connector for that team. */
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

  const existing = await db.one(`select * from github_repo_map where org_id = $1 and lower(repo_full_name) = $2`, [
    input.orgId,
    repo,
  ]);
  if (existing) {
    await db.query(`update github_repo_map set unit_id = $2, installation_id = $3 where id = $1`, [
      existing.id,
      input.unitId,
      input.installationId,
    ]);
  } else {
    await db.query(
      `insert into github_repo_map (id, org_id, installation_id, repo_full_name, unit_id) values ($1, $2, $3, $4, $5)`,
      [newId("ghr"), input.orgId, input.installationId, repo, input.unitId],
    );
  }

  // Live connector row so Connect / M6 shows GitHub as Live for this team.
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
  return (await db.one(`select * from github_repo_map where org_id = $1 and lower(repo_full_name) = $2`, [input.orgId, repo]))!;
}

export async function unitForRepo(db: Db, repoFullName: string): Promise<Row | null> {
  return db.one(`select * from github_repo_map where lower(repo_full_name) = $1`, [repoFullName.trim().toLowerCase()]);
}

/**
 * Handle App webhook events. installation → record; pull_request (merged) → map then ingest;
 * pull_request_review (submitted) → learnFrom the review body for the mapped team.
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
    // Without a Beacon workspace context on the webhook, we only keep the installation id when
    // a map already exists for this installation; otherwise callers use recordInstallation from the UI.
    const existing = await db.one(`select * from github_installation where installation_id = $1`, [String(installation.id)]);
    if (existing) {
      await db.query(`update github_installation set account_login = $2 where installation_id = $1`, [
        String(installation.id),
        String((installation.account as Row)?.login ?? existing.account_login),
      ]);
      return { updated: existing.id };
    }
    return { skipped: "install from Beacon Connect to attach a workspace" };
  }

  if (event === "pull_request") {
    const repo = String((payload.repository as Row)?.full_name ?? "");
    const mapped = repo ? await unitForRepo(db, repo) : null;
    // Prefer team from the map; ingestPullRequest still matches the author for drafts.
    const result = await ingestPullRequest(db, payload);
    if (mapped && "updateId" in result) {
      // Ensure learnFrom landed on the mapped team (ingest learns from the author's home team).
      const pr = payload.pull_request as Row;
      if (pr?.merged && mapped.unit_id) {
        await learnQuietly(db, {
          unitId: mapped.unit_id,
          kind: "pr",
          ref: `${repo}#${pr.number}`,
          label: `PR #${pr.number} in ${repo}`,
          repo,
          text: scrub(String(pr.title ?? "")),
        });
      }
    }
    return result;
  }

  if (event === "pull_request_review") {
    const action = String(payload.action ?? "");
    if (action !== "submitted") return { skipped: `ignored review ${action}` };
    const review = payload.review as Row | undefined;
    const pr = payload.pull_request as Row | undefined;
    const repo = String((payload.repository as Row)?.full_name ?? "");
    const mapped = repo ? await unitForRepo(db, repo) : null;
    if (!mapped) return { skipped: `no team mapped for ${repo}` };
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
    });
    return { learned: true, unitId: mapped.unit_id };
  }

  return { skipped: event ? `ignored ${event}` : "no event" };
}
