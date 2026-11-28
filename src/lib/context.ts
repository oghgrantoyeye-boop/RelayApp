// "What Beacon knows about us" (T-15): the team's learned context, shown and corrected on the team
// page. Most of it is learned; a teammate only confirms, fixes or removes what's wrong. Every change
// is audited and feeds back into learning: a fix is never overwritten, a removal is never re-learned.
import type { Db, Row } from "./db";
import { now } from "./clock";
import { audit, loadPolicy, refContext, type Viewer } from "./data";
import { assertWrite, visibleLevel, type Level } from "./permissions";
import { showContext, type ShownContext } from "./render";

export const CONTEXT_KIND_LABEL: Record<string, string> = {
  responsibility: "Owns",
  system: "Runs",
  knows: "Knows",
  capability: "Can help with",
  how_to_work: "How to ask",
  about: "About",
};
export const CONTEXT_KIND_ORDER = ["responsibility", "system", "knows", "capability", "how_to_work", "about"];

/** Sources that are a tool's record rather than something a person said. */
const TOOL_SOURCES = new Set(["pr", "coding_session", "source_doc"]);
const TOOL_NAME: Record<string, string> = { pr: "GitHub", coding_session: "Claude Code", source_doc: "documents" };
/** Learned context not seen again for this long is flagged as possibly out of date. */
export const STALE_DAYS = 60;

export type ContextTag = "confirmed" | "learned" | "seen";

export interface ContextView extends ShownContext {
  id: string;
  tag: ContextTag;
  /** One line on where it came from. Only the team gets the detailed version. */
  origin: string;
  stale: boolean;
  status: string;
  canEdit: boolean;
}

export function contextTag(row: Row): ContextTag {
  if (row.provenance !== "learned") return "confirmed";
  const refs: { kind: string }[] = row.source_refs ?? [];
  return refs.length > 0 && refs.every((r) => TOOL_SOURCES.has(r.kind)) ? "seen" : "learned";
}

const day = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function originLine(row: Row, tag: ContextTag, detailed: boolean, names: Map<string, string>): string {
  if (tag === "confirmed") {
    const who = row.confirmed_by ? names.get(row.confirmed_by) ?? "a teammate" : "the team";
    const verb = row.provenance === "team_edited" ? "Fixed" : "Confirmed";
    return `${verb} by ${who}${row.confirmed_at ? ` · ${day(row.confirmed_at)}` : ""}`;
  }
  const refs: { kind: string; label: string; at: string }[] = row.source_refs ?? [];
  const last = day(row.last_seen_at);
  if (tag === "seen") {
    const tools = [...new Set(refs.map((r) => TOOL_NAME[r.kind] ?? r.kind))].join(" and ");
    return detailed && refs.length ? `Seen in ${tools}: ${refs.length === 1 ? refs[0].label : `${refs.length} sources, last ${refs[refs.length - 1].label}`} · ${last}` : `Seen in ${tools} · ${last}`;
  }
  if (!detailed || refs.length === 0) return `Learned from the team's activity · ${last}`;
  return `Learned from ${refs.length === 1 ? refs[0].label : `${refs.length} sources, most recently ${refs[refs.length - 1].label}`} · ${last}`;
}

/**
 * The team's context as this viewer may see it. Members see every active entry in full, with sources,
 * and can correct it; they also get recently removed entries so they can undo. Everyone else sees
 * active entries at the entry's shared level, through the same permission check as everything else.
 */
export async function teamContext(db: Db, viewer: Viewer, unitId: string): Promise<{ active: ContextView[]; removed: ContextView[]; isMember: boolean; level: Level | null }> {
  const isMember = viewer.reader.unitIds.includes(unitId);
  const rows = await db.query(
    `select * from context_entry where unit_id = $1 and status in ('active', 'retired') order by last_seen_at desc`,
    [unitId],
  );
  const policy = await loadPolicy(db, viewer.orgId);
  const names = new Map((await db.query(`select id, name from app_user where org_id = $1`, [viewer.orgId])).map((r) => [r.id as string, r.name as string]));
  const staleBefore = now().getTime() - STALE_DAYS * 86_400_000;
  const order = (v: ContextView) => CONTEXT_KIND_ORDER.indexOf(v.kind);
  const view = (row: Row, level: Level): ContextView | null => {
    const shown = showContext(row, level);
    if (!shown) return null;
    const tag = contextTag(row);
    return {
      ...shown,
      id: row.id,
      tag,
      origin: originLine(row, tag, isMember, names),
      stale: tag !== "confirmed" && new Date(row.last_seen_at).getTime() < staleBefore,
      status: row.status,
      canEdit: isMember,
    };
  };
  const active: ContextView[] = [];
  const removed: ContextView[] = [];
  let level: Level | null = null;
  for (const row of rows) {
    if (row.status === "retired") {
      if (isMember) {
        const v = view(row, "full");
        if (v) removed.push(v);
      }
      continue;
    }
    const lvl = visibleLevel(policy, viewer.reader, refContext(row)).level;
    const v = view(row, lvl);
    if (v) {
      active.push(v);
      if (!isMember) level = lvl;
    }
  }
  active.sort((a, b) => order(a) - order(b));
  return { active, removed: removed.slice(0, 10), isMember, level };
}

async function entryFor(db: Db, viewer: Viewer, id: string, what: string): Promise<Row> {
  const row = await db.one(`select * from context_entry where id = $1 and org_id = $2`, [id, viewer.orgId]);
  if (!row) throw new Error("That entry doesn't exist.");
  assertWrite(viewer.reader, row.unit_id, what);
  return row;
}

/** "Looks right": the team stands behind it. Beacon uses it with more confidence. */
export async function confirmEntry(db: Db, viewer: Viewer, id: string) {
  const row = await entryFor(db, viewer, id, "confirm what Beacon learned about them");
  await db.query(
    `update context_entry set provenance = case when provenance = 'team_edited' then provenance else 'team_confirmed' end,
       status = 'active', confidence = 0.95, confirmed_by = $2, confirmed_at = $3, updated_at = $3 where id = $1`,
    [id, viewer.user.id, now()],
  );
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "context_confirm", targetKind: "context_entry", targetId: id, detail: { unit: row.unit_id, kind: row.kind } });
}

/** "Fix": the team's wording replaces what Beacon learned, and later signals never overwrite it. */
export async function editEntry(db: Db, viewer: Viewer, id: string, input: { title: string; body: string }) {
  const row = await entryFor(db, viewer, id, "fix what Beacon learned about them");
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error("Give it a short title.");
  const body = input.body.trim().slice(0, 600);
  await db.query(
    `update context_entry set title = $2, body = $3, provenance = 'team_edited', status = 'active', confidence = 0.95,
       confirmed_by = $4, confirmed_at = $5, updated_at = $5 where id = $1`,
    [id, title, body, viewer.user.id, now()],
  );
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "context_edit", targetKind: "context_entry", targetId: id, detail: { unit: row.unit_id, before: { title: row.title, body: row.body } } });
}

/** "Remove": hidden from everyone, kept so the same claim is never learned again. Undo restores it. */
export async function retireEntry(db: Db, viewer: Viewer, id: string) {
  const row = await entryFor(db, viewer, id, "remove what Beacon learned about them");
  await db.query(`update context_entry set status = 'retired', updated_at = $2 where id = $1`, [id, now()]);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "context_remove", targetKind: "context_entry", targetId: id, detail: { unit: row.unit_id, title: row.title } });
}

export async function restoreEntry(db: Db, viewer: Viewer, id: string) {
  const row = await entryFor(db, viewer, id, "restore what Beacon learned about them");
  if (row.status !== "retired") return;
  await db.query(`update context_entry set status = 'active', updated_at = $2 where id = $1`, [id, now()]);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "context_restore", targetKind: "context_entry", targetId: id, detail: { unit: row.unit_id } });
}

export interface LearnedView {
  id: string;
  kind: string;
  kindLabel: string;
  title: string;
  body: string;
  /** pending: waits for a teammate before other teams see it. active: already on the team page. retired: dropped. */
  status: "pending" | "active" | "retired";
  confirmed: boolean;
  /** Why it waits for a teammate, when it does. */
  why: string | null;
}

/**
 * What Beacon learned from one answer (T-24), for the person who just answered and their team.
 * Only the team the question was sent to sees it: the entries are its own context, in full.
 */
export async function learnedFromAnswer(db: Db, viewer: Viewer, requestId: string): Promise<{ team: string; slug: string; entries: LearnedView[] } | null> {
  const req = await db.one(
    `select r.to_unit_id, u.name, u.slug from request r join unit u on u.id = r.to_unit_id where r.id = $1 and u.org_id = $2`,
    [requestId, viewer.orgId],
  );
  if (!req || !viewer.reader.unitIds.includes(req.to_unit_id)) return null;
  const rows = await db.query(
    `select * from context_entry where unit_id = $1 and source_refs @> $2::jsonb order by first_seen_at`,
    [req.to_unit_id, JSON.stringify([{ kind: "answer", ref: requestId }])],
  );
  const entries = rows.map((row): LearnedView => {
    const marked = (row.marking_ids ?? []).length > 0;
    const why =
      row.status !== "pending"
        ? null
        : row.kind === "responsibility"
          ? "This says who owns what, so a teammate confirms it before other teams see it."
          : row.kind === "capability"
            ? `This says what ${req.name} can take on, so a teammate confirms it before other teams see it.`
            : marked
              ? "The question was marked, so a teammate confirms this before other teams see it."
              : "It came from something fewer people can see, so a teammate confirms it before other teams see it.";
    return {
      id: row.id,
      kind: row.kind,
      kindLabel: CONTEXT_KIND_LABEL[row.kind] ?? row.kind,
      title: row.title,
      body: row.body,
      status: row.status,
      confirmed: row.provenance !== "learned",
      why,
    };
  });
  return { team: req.name, slug: req.slug, entries };
}
