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
  const updateId = newId("up");
  await db.query(
    `insert into team_update (id, unit_id, author_id, period_start, body_md, source, status, created_at) values ($1, $2, $3, $4, $5, $6, 'draft', $7)`,
    [updateId, unitId, viewer.user.id, today(), body, source, now()],
  );
  await addDraftItems(db, viewer, updateId, source, items, ref);
  return updateId;
}

async function addDraftItems(db: Db, viewer: Viewer, updateId: string, source: string, items: { kind: string; text: string }[], ref: string) {
  const unitId = viewer.team.id;
  const teams = await teamInfos(db, viewer.orgId);
  for (const item of items) {
    const { summary, headline } = levelTexts(item.text);
    await db.query(
      `insert into update_item (id, update_id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, status, source_kind, source_ref, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11, $12)`,
      [newId("ui"), updateId, unitId, viewer.user.id, item.kind, item.text, summary, headline, suggestAffected(item.text, unitId, teams), source, ref, now()],
    );
  }
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

export type CodingTool = "claude_code" | "codex" | "cursor";
export const CODING_TOOL_LABEL: Record<CodingTool, string> = { claude_code: "Claude Code", codex: "Codex", cursor: "Cursor" };

export interface CodingReport extends Partial<SessionInput> {
  tool?: string;
  /** The agent's own session or conversation id, so repeat reports from one session merge. */
  session_id?: string;
}

const KEEP = { prompts: 12, notes: 4, commits: 12 } as const;

function mergeList(old: unknown, add: string[], keep: number): string[] {
  const prev = Array.isArray(old) ? (old as string[]) : [];
  const out = [...prev];
  for (const x of add) if (x && !out.includes(x)) out.push(x);
  return out.slice(-keep);
}

/**
 * A report from a local coding agent (T-63). Every session and turn from one person on one day
 * feeds one rolling draft, with items per repo. Nothing is shared until they publish it.
 */
export async function ingestCodingSession(db: Db, viewer: Viewer, payload: CodingReport) {
  const clean = (xs: unknown) => (Array.isArray(xs) ? xs : []).map((x) => scrub(String(x)).slice(0, 600)).filter(Boolean).slice(-12);
  const tool: CodingTool = payload.tool === "codex" || payload.tool === "cursor" ? payload.tool : "claude_code";
  const repo = scrub(String(payload.repo ?? "unknown repo")).slice(0, 120);
  const report: SessionInput = {
    repo,
    branch: scrub(String(payload.branch ?? "main")).slice(0, 120),
    prompts: clean(payload.prompts),
    notes: clean(payload.notes),
    commits: clean(payload.commits),
    diffstat: scrub(String(payload.diffstat ?? "")).slice(0, 200),
  };
  const key = String(payload.session_id ?? "").slice(0, 200) || newId("cs");

  // Today's open draft from coding agents, or a new one.
  const draft = await db.one(
    `select id from team_update where author_id = $1 and unit_id = $2 and source = 'coding_agent' and status = 'draft' and period_start = $3 order by created_at desc limit 1`,
    [viewer.user.id, viewer.team.id, today()],
  );
  const updateId = draft ? (draft.id as string) : await createDraft(db, viewer, "coding_agent", "", [], repo);

  // Merge into the session's row. A session whose earlier reports went into a draft that has
  // since been published or discarded starts over, so nothing is shared twice.
  const prev = await db.one(`select * from coding_session where user_id = $1 and tool = $2 and session_key = $3`, [viewer.user.id, tool, key]);
  const fresh = !prev || prev.update_id !== updateId || prev.repo !== repo;
  const merged = {
    prompts: mergeList(fresh ? [] : prev.prompts, report.prompts, KEEP.prompts),
    notes: mergeList(fresh ? [] : prev.notes, report.notes, KEEP.notes),
    commits: mergeList(fresh ? [] : prev.commits, report.commits, KEEP.commits),
  };
  const diffstat = report.diffstat || (fresh ? "" : String(prev.diffstat ?? ""));
  if (prev) {
    await db.query(
      `update coding_session set update_id = $2, repo = $3, branch = $4, prompts = $5, notes = $6, commits = $7, diffstat = $8, updated_at = $9 where id = $1`,
      [prev.id, updateId, repo, report.branch, JSON.stringify(merged.prompts), JSON.stringify(merged.notes), JSON.stringify(merged.commits), diffstat, now()],
    );
  } else {
    await db.query(
      `insert into coding_session (id, org_id, user_id, tool, session_key, update_id, repo, branch, prompts, notes, commits, diffstat, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
      [newId("cs"), viewer.orgId, viewer.user.id, tool, key, updateId, repo, report.branch, JSON.stringify(merged.prompts), JSON.stringify(merged.notes), JSON.stringify(merged.commits), diffstat, now()],
    );
  }

  // Redraft this repo's items from every session that fed today's draft. Draft items aren't edited
  // until the person publishes, so replacing them loses nothing.
  const sessions = await db.query(`select * from coding_session where update_id = $1 and repo = $2 order by created_at, id`, [updateId, repo]);
  const all = (k: "prompts" | "notes" | "commits", keep: number) => sessions.flatMap((r) => (Array.isArray(r[k]) ? (r[k] as string[]) : [])).slice(-keep);
  const branches = [...new Set(sessions.map((r) => String(r.branch)))];
  const input: SessionInput = {
    repo,
    branch: branches.join(", "),
    prompts: all("prompts", KEEP.prompts),
    notes: all("notes", 6),
    commits: [...new Set(all("commits", 24))].slice(-KEEP.commits),
    diffstat: String(sessions[sessions.length - 1]?.diffstat ?? ""),
  };
  const { items, by } = await draftFromSession(input);
  await db.query(`delete from update_item where update_id = $1 and source_ref = $2 and status = 'draft'`, [updateId, repo]);
  await addDraftItems(db, viewer, updateId, "coding_agent", items, repo);

  // The draft's body lists each repo, its tools and branches, and its commits.
  const rows = await db.query(`select repo, tool, branch, commits from coding_session where update_id = $1 order by created_at, id`, [updateId]);
  const byRepo = new Map<string, { tools: Set<string>; branches: Set<string>; commits: string[] }>();
  for (const r of rows) {
    const e = byRepo.get(r.repo) ?? { tools: new Set(), branches: new Set(), commits: [] };
    e.tools.add(CODING_TOOL_LABEL[r.tool as CodingTool] ?? r.tool);
    e.branches.add(r.branch);
    for (const c of (r.commits as string[]) ?? []) if (!e.commits.includes(c)) e.commits.push(c);
    byRepo.set(r.repo, e);
  }
  const body = [...byRepo.entries()]
    .map(([name, e]) => [`${[...e.tools].join(", ")} in ${name} (${[...e.branches].join(", ")})`, ...e.commits.slice(-KEEP.commits).map((c) => `- ${c}`)].join("\n"))
    .join("\n\n");
  await db.query(`update team_update set body_md = $2 where id = $1`, [updateId, body]);

  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "source_coding_session", targetKind: "update", targetId: updateId, detail: { repo, tool, items: items.length, by } });
  // The session itself stays private to its author until they publish the draft. Beacon learns only
  // that the team works in this repository, which the team's GitHub activity would show anyway.
  // Once per session: Codex and Cursor report every turn.
  if (repo !== "unknown repo" && fresh)
    await learnQuietly(db, { unitId: viewer.team.id, kind: "coding_session", ref: `${repo}#${report.branch}`, label: `${CODING_TOOL_LABEL[tool]} session in ${repo}`, repo, text: `Worked in ${repo}.`, actorId: viewer.user.id });
  const total = await db.one(`select count(*)::int as n from update_item where update_id = $1`, [updateId]);
  return { updateId, items: (total?.n as number) ?? items.length };
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
