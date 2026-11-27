import type { Db, Row } from "./db";
import { daysBetween, fmt, now, today } from "./clock";
import { COMMITMENT_SELECT, audit, loadPolicy, refCommitment, teamMembers, type Viewer } from "./data";
import { deliver } from "./deliver";
import { PermissionError, rank, visibleLevel, type Level, type Policy, type Reader } from "./permissions";
import { showCommitment, type ShownCommitment } from "./render";

export type CommitmentState = "draft" | "on_track" | "at_risk" | "slipped" | "done" | "rejected";

export interface CommitmentView {
  id: string;
  level: Level;
  shown: ShownCommitment;
  state: CommitmentState;
  daysLate: number;
  due: string;
  originalDue: string | null;
  ownerUnit: { id: string; name: string; slug: string; color: string };
  waitingUnit: { id: string; name: string; slug: string; color: string } | null;
  ownerName: string | null;
  blockedBy: CommitmentView | null;
  row: Row;
}

/** Slipped: past due and not done. At risk: something it depends on slipped or is at risk. */
export function computeStates(rows: Row[], day = today()): Map<string, CommitmentState> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const memo = new Map<string, CommitmentState>();
  const stateOf = (id: string, seen: Set<string>): CommitmentState => {
    if (memo.has(id)) return memo.get(id)!;
    const r = byId.get(id);
    if (!r) return "on_track";
    let s: CommitmentState;
    if (r.status === "draft") s = "draft";
    else if (r.status === "done") s = "done";
    else if (r.status === "rejected") s = "rejected";
    else if (r.due_date < day) s = "slipped";
    else if (r.blocked_by_id && !seen.has(r.blocked_by_id)) {
      const up = stateOf(r.blocked_by_id, new Set([...seen, id]));
      s = up === "slipped" || up === "at_risk" ? "at_risk" : "on_track";
      // An upstream date that moved past this one's due date is also a risk.
      const upRow = byId.get(r.blocked_by_id);
      if (s === "on_track" && upRow && upRow.status === "open" && upRow.due_date > r.due_date) s = "at_risk";
    } else s = "on_track";
    memo.set(id, s);
    return s;
  };
  for (const r of rows) stateOf(r.id, new Set());
  return memo;
}

export async function allCommitments(db: Db): Promise<Row[]> {
  return db.query(`${COMMITMENT_SELECT} order by c.due_date`);
}

function view(policy: Policy, reader: Reader, row: Row, rows: Map<string, Row>, states: Map<string, CommitmentState>, depth = 0): CommitmentView | null {
  const { level } = visibleLevel(policy, reader, refCommitment(row));
  if (level === "none") return null;
  const shown = showCommitment(row, level, row.owner_unit_name);
  if (!shown) return null;
  const blockedRow = row.blocked_by_id ? rows.get(row.blocked_by_id) : null;
  return {
    id: row.id,
    level,
    shown,
    state: states.get(row.id) ?? "on_track",
    daysLate: row.status === "open" && row.due_date < today() ? daysBetween(row.due_date, today()) : 0,
    due: row.due_date,
    originalDue: row.original_due_date !== row.due_date ? row.original_due_date : null,
    ownerUnit: { id: row.owner_unit_id, name: row.owner_unit_name, slug: row.owner_unit_slug, color: row.owner_unit_color },
    waitingUnit: row.waiting_unit_id ? { id: row.waiting_unit_id, name: row.waiting_unit_name, slug: row.waiting_unit_slug, color: row.waiting_unit_color } : null,
    ownerName: rank(level) >= rank("summary") ? row.owner_name : null,
    blockedBy: blockedRow && depth < 4 ? view(policy, reader, blockedRow, rows, states, depth + 1) : null,
    row,
  };
}

export async function commitmentViews(db: Db, reader: Reader, filter: (r: Row) => boolean): Promise<CommitmentView[]> {
  const policy = await loadPolicy(db);
  const rows = await allCommitments(db);
  const states = computeStates(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows
    .filter(filter)
    .map((r) => view(policy, reader, r, byId, states))
    .filter((v): v is CommitmentView => !!v);
}

/** What a team owes others and what others owe it. */
export async function teamCommitments(db: Db, viewer: Viewer, unitId: string) {
  const all = await commitmentViews(db, viewer.reader, (r) => r.owner_unit_id === unitId || r.waiting_unit_id === unitId);
  const order: CommitmentState[] = ["slipped", "at_risk", "draft", "on_track", "done", "rejected"];
  const sort = (a: CommitmentView, b: CommitmentView) => order.indexOf(a.state) - order.indexOf(b.state) || a.due.localeCompare(b.due);
  return {
    owedBy: all.filter((c) => c.ownerUnit.id === unitId && c.state !== "rejected").sort(sort),
    owedTo: all.filter((c) => c.waitingUnit?.id === unitId && c.ownerUnit.id !== unitId && c.state !== "rejected").sort(sort),
  };
}

/** Everyone a change to this commitment matters to: the waiting team and every team downstream of it. */
async function affectedTeams(db: Db, id: string): Promise<{ unitId: string; via: Row }[]> {
  const rows = await allCommitments(db);
  const out: { unitId: string; via: Row }[] = [];
  const visit = (cid: string, depth: number) => {
    if (depth > 5) return;
    for (const r of rows.filter((x) => x.blocked_by_id === cid && x.status === "open")) {
      out.push({ unitId: r.owner_unit_id, via: r });
      if (r.waiting_unit_id) out.push({ unitId: r.waiting_unit_id, via: r });
      visit(r.id, depth + 1);
    }
  };
  const self = rows.find((r) => r.id === id);
  if (self?.waiting_unit_id) out.push({ unitId: self.waiting_unit_id, via: self });
  visit(id, 0);
  return out;
}

/** Tell every affected person, each at their own level. */
export async function notifyCommitmentChange(db: Db, commitmentId: string, headline: (shown: ShownCommitment, via: ShownCommitment | null) => { subject: string; body: string }) {
  const policy = await loadPolicy(db);
  const rows = await allCommitments(db);
  const row = rows.find((r) => r.id === commitmentId);
  if (!row) return { teams: [] as string[], people: 0 };
  const teams = await affectedTeams(db, commitmentId);
  let people = 0;
  const done = new Set<string>();
  for (const { unitId, via } of teams) {
    if (done.has(unitId) || unitId === row.owner_unit_id) continue;
    done.add(unitId);
    const reader: Reader = { userId: `team:${unitId}`, unitIds: [unitId] };
    const lvl = visibleLevel(policy, reader, refCommitment(row)).level;
    const shown = showCommitment(row, lvl, row.owner_unit_name);
    if (!shown) continue;
    const viaShown = via.id !== row.id ? showCommitment(via, visibleLevel(policy, reader, refCommitment(via)).level, via.owner_unit_name) : null;
    const msg = headline(shown, viaShown);
    const members = await teamMembers(db, [unitId]);
    people += await deliver(db, members.map((m) => m.id), { kind: "commitment_alert", ...msg, refs: [{ type: "commitment", id: row.id, href: "/commitments" }] });
  }
  return { teams: [...done], people };
}

export async function confirmCommitment(db: Db, viewer: Viewer, id: string, edits: { title?: string; due_date?: string } = {}) {
  const row = await db.one(`${COMMITMENT_SELECT} where c.id = $1`, [id]);
  if (!row) throw new Error("Commitment not found");
  const isOwner = row.owner_user_id === viewer.user.id;
  const isLead = viewer.units.some((u) => u.id === row.owner_unit_id && u.role === "lead");
  if (row.status !== "draft") throw new Error("Only drafts need confirming");
  if (!isOwner && !(isLead && row.revises_id)) throw new PermissionError("Only the commitment's owner can confirm it.");
  const due = edits.due_date || row.due_date;

  if (row.revises_id) {
    const orig = await db.one(`${COMMITMENT_SELECT} where c.id = $1`, [row.revises_id]);
    if (!orig) throw new Error("Original commitment not found");
    if (orig.owner_unit_id !== row.owner_unit_id) throw new PermissionError("A team can only revise its own commitments.");
    const reason = `Moved from ${fmt(orig.due_date)} to ${fmt(due)} in ${row.owner_unit_name}'s update (${fmt(now())}).`;
    await db.query(`update commitment set due_date = $2, slip_reason = $3 where id = $1`, [orig.id, due, reason]);
    await db.query(`update commitment set status = 'rejected', due_date = $2 where id = $1`, [id, due]);
    await audit(db, { actorId: viewer.user.id, action: "revise_commitment", targetKind: "commitment", targetId: orig.id, detail: { from: orig.due_date, to: due, draft: id } });
    return notifyCommitmentChange(db, orig.id, (shown, via) => ({
      subject: `${row.owner_unit_name} moved a commitment to ${fmt(due)}`,
      body: `${shown.title}: now due ${fmt(due)} (was ${fmt(orig.due_date)}).${via ? ` This affects "${via.title}".` : ""}`,
    }));
  }

  await db.query(`update commitment set status = 'open', confirmed_at = $2, title = $3, due_date = $4, original_due_date = $4 where id = $1`, [
    id, now(), edits.title || row.title, due,
  ]);
  await audit(db, { actorId: viewer.user.id, action: "confirm_commitment", targetKind: "commitment", targetId: id, detail: { due } });
  return notifyCommitmentChange(db, id, (shown) => ({
    subject: `${row.owner_unit_name} committed to ${fmt(due)}`,
    body: `${shown.title}, due ${fmt(due)}.`,
  }));
}

export async function rejectCommitment(db: Db, viewer: Viewer, id: string) {
  const row = await db.one(`${COMMITMENT_SELECT} where c.id = $1`, [id]);
  if (!row || row.status !== "draft") throw new Error("Only drafts can be rejected");
  if (row.owner_user_id !== viewer.user.id && !viewer.units.some((u) => u.id === row.owner_unit_id && u.role === "lead"))
    throw new PermissionError("Only the commitment's owner can reject it.");
  await db.query(`update commitment set status = 'rejected' where id = $1`, [id]);
  await audit(db, { actorId: viewer.user.id, action: "reject_commitment", targetKind: "commitment", targetId: id });
}

export async function markDone(db: Db, viewer: Viewer, id: string) {
  const row = await db.one(`${COMMITMENT_SELECT} where c.id = $1`, [id]);
  if (!row) throw new Error("Commitment not found");
  if (!viewer.reader.unitIds.includes(row.owner_unit_id)) throw new PermissionError("Only the owning team can close its commitments.");
  await db.query(`update commitment set status = 'done', done_at = $2 where id = $1`, [id, now()]);
  await audit(db, { actorId: viewer.user.id, action: "complete_commitment", targetKind: "commitment", targetId: id });
  await notifyCommitmentChange(db, id, (shown) => ({ subject: `${row.owner_unit_name} delivered a commitment`, body: `${shown.title} is done.` }));
}
