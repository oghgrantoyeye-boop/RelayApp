// Draft sources: coding-agent sessions and merged pull requests become draft updates for their
// author. Nothing is shared until the author reviews and publishes it in Write update.
import type { DemoPack } from "./demos";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db, Row } from "./db";
import { now, today } from "./clock";
import { audit, loadViewer, newId, type Viewer } from "./data";
import { draftFromSession, suggestAffected, type SessionInput } from "./ai/tasks";
import { teamInfos } from "./updates";
import { levelTexts, shorten } from "./ai/offline";
import { learnQuietly } from "./context-learn";
import { localId } from "./scoped";

async function createDraft(db: Db, viewer: Viewer, source: "coding_agent" | "github", body: string, items: { kind: string; text: string }[], ref: string) {
  const unitId = viewer.team.id;
  const teams = await teamInfos(db, viewer.orgId);
  const updateId = newId("up");
  await db.query(
    `insert into team_update (id, unit_id, author_id, period_start, body_md, source, status, created_at) values ($1, $2, $3, $4, $5, $6, 'draft', $7)`,
    [updateId, unitId, viewer.user.id, today(), body, source, now()],
  );
  for (const item of items) {
    const { summary, headline } = levelTexts(item.text);
    await db.query(
      `insert into update_item (id, update_id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, status, source_kind, source_ref, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11, $12)`,
      [newId("ui"), updateId, unitId, viewer.user.id, item.kind, item.text, summary, headline, suggestAffected(item.text, unitId, teams), source, ref, now()],
    );
  }
  return updateId;
}

/** Strip anything that looks like a secret before it's stored, even in a draft. */
export function scrub(s: string): string {
  return s
    .replace(/\b(sk|rk|pk|ghp|gho|xox[abp]|rly)_[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, "[redacted]")
    .replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

export async function userByToken(db: Db, token: string | null): Promise<Viewer | null> {
  if (!token) return null;
  const { findUserIdByApiToken } = await import("./auth/api-tokens");
  const id = await findUserIdByApiToken(db, token);
  return id ? loadViewer(db, id) : null;
}

export async function ingestCodingSession(db: Db, viewer: Viewer, payload: Partial<SessionInput>) {
  const clean = (xs: unknown) => (Array.isArray(xs) ? xs : []).map((x) => scrub(String(x)).slice(0, 600)).slice(0, 12);
  const s: SessionInput = {
    repo: scrub(String(payload.repo ?? "unknown repo")).slice(0, 120),
    branch: scrub(String(payload.branch ?? "main")).slice(0, 120),
    prompts: clean(payload.prompts),
    notes: clean(payload.notes),
    commits: clean(payload.commits),
    diffstat: scrub(String(payload.diffstat ?? "")).slice(0, 200),
  };
  const { items, by } = await draftFromSession(s);
  const body = [`Coding session in ${s.repo} (${s.branch})`, ...s.commits.map((c) => `- ${c}`)].join("\n");
  const id = await createDraft(db, viewer, "coding_agent", body, items, `${s.repo}#${s.branch}`);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "source_coding_session", targetKind: "update", targetId: id, detail: { repo: s.repo, items: items.length, by } });
  // The session itself stays private to its author until they publish the draft. Beacon learns only
  // that the team works in this repository, which the team's GitHub activity would show anyway.
  if (s.repo !== "unknown repo")
    await learnQuietly(db, { unitId: viewer.team.id, kind: "coding_session", ref: `${s.repo}#${s.branch}`, label: `Claude Code session in ${s.repo}`, repo: s.repo, text: `Worked in ${s.repo}.`, actorId: viewer.user.id });
  return { updateId: id, items: items.length };
}

export function verifyGithubSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production"; // local/demo only
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** GitHub "pull_request" webhook: a merged PR becomes a draft progress item for its author. */
export async function ingestPullRequest(
  db: Db,
  event: Row,
  opts?: { learnUnitId?: string },
): Promise<{ updateId: string } | { skipped: string }> {
  const pr = event.pull_request;
  if (event.action !== "closed" || !pr?.merged) return { skipped: "not a merged pull request" };
  const login = String(pr.user?.login ?? "");
  // With a known team, only match the author inside that team's workspace.
  const orgOf = opts?.learnUnitId ? (await db.one(`select org_id from unit where id = $1`, [opts.learnUnitId]))?.org_id : null;
  const user = orgOf
    ? await db.one(`select id from app_user where github_login = $1 and org_id = $2`, [login, orgOf])
    : await db.one(`select id from app_user where github_login = $1 order by id limit 1`, [login]);
  if (!user) return { skipped: `no Beacon user for GitHub login ${login}` };
  const viewer = await loadViewer(db, user.id);
  if (!viewer) return { skipped: "user has no team" };
  const repo = String(event.repository?.full_name ?? "repo");
  const body = scrub(String(pr.body ?? "")).split(/\n\s*\n/)[0] ?? "";
  const text = `Merged #${pr.number} in ${repo}: ${scrub(String(pr.title))}.${body ? ` ${shorten(body, 200)}` : ""}`;
  const id = await createDraft(db, viewer, "github", text, [{ kind: "progress", text }], `${repo}#${pr.number}`);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "source_github_pr", targetKind: "update", targetId: id, detail: { repo, number: pr.number } });
  // Prefer the App-mapped team when present; otherwise the author's home team.
  const learnUnitId = opts?.learnUnitId ?? viewer.team.id;
  await learnQuietly(db, {
    unitId: learnUnitId,
    kind: "pr",
    ref: `${repo}#${pr.number}`,
    label: `PR #${pr.number} in ${repo}`,
    repo,
    text: scrub(String(pr.title)),
    actorId: viewer.user.id,
  });
  return { updateId: id };
}

/** The Connect page's "Simulate a merged pull request": the same code path, with canned input for the person's team. */
export function samplePullRequest(viewer: Viewer, demo: DemoPack) {
  const session = demo.ui.sampleSessions[localId(demo.id, viewer.team.id)] ?? Object.values(demo.ui.sampleSessions)[0];
  const repo = session?.repo ?? `${demo.org.domain}/${localId(demo.id, viewer.team.id)}`;
  const title = session?.commits[0]?.replace(/^\w+\s+/, "") ?? `Update the ${viewer.team.name} onboarding checklist`;
  return {
    action: "closed",
    repository: { full_name: repo },
    pull_request: {
      number: 1842,
      merged: true,
      title,
      body: session?.notes[0] ?? "Fixes two links that still pointed at the old wiki.",
      user: { login: viewer.user.github_login },
    },
  };
}
