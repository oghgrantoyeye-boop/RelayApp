// Draft sources: coding-agent sessions and merged pull requests become draft updates for their
// author. Nothing is shared until the author reviews and publishes it in Write update.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db, Row } from "./db";
import { now, today } from "./clock";
import { audit, loadViewer, newId, type Viewer } from "./data";
import { draftFromSession, suggestAffected, type SessionInput } from "./ai/tasks";
import { teamInfos } from "./updates";
import { levelTexts, shorten } from "./ai/offline";

async function createDraft(db: Db, viewer: Viewer, source: "coding_agent" | "github", body: string, items: { kind: string; text: string }[], ref: string) {
  const unitId = viewer.team.id;
  const teams = await teamInfos(db);
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
  const u = await db.one(`select id from app_user where api_token = $1 and kind = 'human'`, [token]);
  return u ? loadViewer(db, u.id) : null;
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
  await audit(db, { actorId: viewer.user.id, action: "source_coding_session", targetKind: "update", targetId: id, detail: { repo: s.repo, items: items.length, by } });
  return { updateId: id, items: items.length };
}

export function verifyGithubSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // not configured: accept (demo)
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** GitHub "pull_request" webhook: a merged PR becomes a draft progress item for its author. */
export async function ingestPullRequest(db: Db, event: Row): Promise<{ updateId: string } | { skipped: string }> {
  const pr = event.pull_request;
  if (event.action !== "closed" || !pr?.merged) return { skipped: "not a merged pull request" };
  const login = String(pr.user?.login ?? "");
  const user = await db.one(`select id from app_user where github_login = $1`, [login]);
  if (!user) return { skipped: `no Relay user for GitHub login ${login}` };
  const viewer = await loadViewer(db, user.id);
  if (!viewer) return { skipped: "user has no team" };
  const repo = String(event.repository?.full_name ?? "repo");
  const body = scrub(String(pr.body ?? "")).split(/\n\s*\n/)[0] ?? "";
  const text = `Merged #${pr.number} in ${repo}: ${scrub(String(pr.title))}.${body ? ` ${shorten(body, 200)}` : ""}`;
  const id = await createDraft(db, viewer, "github", text, [{ kind: "progress", text }], `${repo}#${pr.number}`);
  await audit(db, { actorId: viewer.user.id, action: "source_github_pr", targetKind: "update", targetId: id, detail: { repo, number: pr.number } });
  return { updateId: id };
}

/** Demo buttons on the Connect page: the same code paths, with canned input for the person's team. */
export const SAMPLE_SESSIONS: Record<string, Partial<SessionInput>> = {
  payments: {
    repo: "northwind/payments-api",
    branch: "feat/webhook-retries",
    prompts: ["Add exponential backoff to webhook retries with 5 attempts over 24 hours", "Make retries respect the per-merchant burst limit once Platform ships it"],
    notes: ["Backoff and the retry queue are done and tested.", "Still blocked on Platform's per-merchant burst limits before we can turn retries on."],
    commits: ["a1b2c3d Add retry scheduler with exponential backoff", "d4e5f6a Respect per-merchant limits when present"],
    diffstat: "14 files changed, 612 insertions(+), 88 deletions(-)",
  },
  platform: {
    repo: "northwind/platform",
    branch: "fix/limiter-leak",
    prompts: ["Find the memory leak in the per-merchant limiter under load"],
    notes: ["Fixed the leak: buckets for idle merchants were never evicted. Load test is stable for 2 hours."],
    commits: ["9f8e7d6 Evict idle merchant buckets from the limiter"],
    diffstat: "3 files changed, 74 insertions(+), 12 deletions(-)",
  },
};

export function samplePullRequest(viewer: Viewer) {
  const repo = viewer.team.id === "platform" ? "northwind/platform" : "northwind/payments-api";
  return {
    action: "closed",
    repository: { full_name: repo },
    pull_request: {
      number: 1842,
      merged: true,
      title: viewer.team.id === "platform" ? "Evict idle merchant buckets from the per-merchant limiter" : "Add retry scheduler for webhook deliveries",
      body: viewer.team.id === "platform" ? "Fixes the memory leak found in load testing. Unblocks per-merchant burst limits." : "Retries use exponential backoff over 24 hours.",
      user: { login: viewer.user.github_login },
    },
  };
}
