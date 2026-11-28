// The request lifecycle as the asker sees it (T-25, roadmap Phase 2 step 3).
//
// Stored statuses stay small: open, answered, accepted (answered with a commitment), declined and
// resolved. What the asker sees is derived from them and a few timestamps, so an open request stays
// in every team-queue query while it is awaiting the team, needs the asker's input or has gone
// unresolved. Every change of what the asker sees is written to the audit log as request_status.
import type { Db, Row } from "./db";
import { fmt, now } from "./clock";
import { audit, type Viewer } from "./data";
import { deliver } from "./deliver";
import { PermissionError } from "./permissions";

export type RequestState = "awaiting_team" | "needs_info" | "answered" | "resolved" | "declined" | "unresolved";

export const REQUEST_STATE_LABEL: Record<RequestState, string> = {
  awaiting_team: "Awaiting the team",
  needs_info: "Needs your input",
  answered: "Answered",
  resolved: "Resolved",
  declined: "Declined",
  unresolved: "No reply yet",
};

/** A request with no response for this many business days becomes unresolved. */
export const UNRESOLVED_AFTER_BUSINESS_DAYS = 3;

const time = (v: unknown) => (v ? new Date(v as string).getTime() : 0);

/** Whether the team is waiting on the asker: it asked for detail and hasn't had a reply since. */
function waitingOnAsker(r: Row) {
  return !!r.detail_asked_at && time(r.detail_replied_at) < time(r.detail_asked_at);
}

export function requestState(r: Row): RequestState {
  if (r.status === "declined") return "declined";
  if (r.status === "resolved") return "resolved";
  if (r.status === "answered" || r.status === "accepted") return "answered";
  if (waitingOnAsker(r)) return "needs_info";
  if (r.unresolved_at) return "unresolved";
  return "awaiting_team";
}

/**
 * Whole business days that have passed: each full 24 hours after `from` that lands on a weekday
 * counts once. Asked Friday 9:00, it's 3 on Wednesday 9:00. Public holidays aren't modelled.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  let n = 0;
  for (let t = from.getTime() + 86_400_000; t <= to.getTime(); t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

/** When the team's clock last started: asked, asked again, sent to the lead, or the asker replied. */
export function waitingSince(r: Row): Date {
  return new Date(Math.max(time(r.created_at), time(r.asked_again_at), time(r.escalated_at), time(r.detail_replied_at)));
}

/** Record a change in what the asker sees. Every transition goes through here. */
export async function auditStatus(db: Db, actor: Viewer | null, r: Row, to: RequestState, detail: Record<string, unknown> = {}) {
  await audit(db, {
    orgId: r.org_id,
    actorId: actor?.user.id ?? null,
    action: "request_status",
    targetKind: "request",
    targetId: r.id,
    detail: { from: requestState(r), to, ...detail },
  });
}

/**
 * Mark open requests with no response after UNRESOLVED_AFTER_BUSINESS_DAYS as unresolved and tell
 * each asker, once, what they can do next. Safe to run on every page load: already-unresolved
 * requests and ones waiting on the asker are skipped.
 */
export async function sweepUnresolved(db: Db, orgId: string): Promise<string[]> {
  const rows = await db.query(
    `select r.*, tu.name as to_name from request r join unit tu on tu.id = r.to_unit_id
     where r.org_id = $1 and r.status = 'open' and r.unresolved_at is null`,
    [orgId],
  );
  const at = now();
  const marked: string[] = [];
  for (const r of rows) {
    if (waitingOnAsker(r)) continue;
    if (businessDaysBetween(waitingSince(r), at) < UNRESOLVED_AFTER_BUSINESS_DAYS) continue;
    await auditStatus(db, null, r, "unresolved", { business_days: UNRESOLVED_AFTER_BUSINESS_DAYS });
    await db.query(`update request set unresolved_at = $2 where id = $1`, [r.id, at]);
    await deliver(db, [r.requester_id], {
      kind: "request_unresolved",
      subject: `No reply from ${r.to_name} yet`,
      body: `You asked on ${fmt(r.created_at)}: ${r.title}\n\nNo one has answered in ${UNRESOLVED_AFTER_BUSINESS_DAYS} business days. You can send it to the team lead or ask again.`,
      refs: [{ type: "request", id: r.id, href: "/questions" }],
    });
    marked.push(r.id);
  }
  return marked;
}

async function ownRequest(db: Db, viewer: Viewer, id: string): Promise<Row> {
  const r = await db.one(
    `select r.*, tu.name as to_name, m.user_id as assignee_user_id from request r join unit tu on tu.id = r.to_unit_id
     left join member m on m.id = r.assignee_member_id where r.id = $1 and r.org_id = $2`,
    [id, viewer.orgId],
  );
  if (!r) throw new Error("That request doesn't exist.");
  if (r.requester_id !== viewer.user.id) throw new PermissionError("Only the person who asked can do that.");
  return r;
}

/** Who on the team should hear about a change: whoever picked it up, else the owner, else the lead. */
async function teamContact(db: Db, r: Row): Promise<string[]> {
  if (r.claimed_by) return [r.claimed_by];
  if (r.assignee_user_id) return [r.assignee_user_id];
  const lead = await db.one(`select user_id from member where unit_id = $1 and role = 'lead' limit 1`, [r.to_unit_id]);
  return lead ? [lead.user_id] : [];
}

/** "That answers it": the asker closes an answered request. */
export async function resolveRequest(db: Db, viewer: Viewer, id: string) {
  const r = await ownRequest(db, viewer, id);
  if (requestState(r) !== "answered") throw new Error("Only an answered question can be marked as answered.");
  await auditStatus(db, viewer, r, "resolved");
  await db.query(`update request set status = 'resolved', resolved_at = $2 where id = $1`, [id, now()]);
}

/** The asker answers the team's "Ask them for more detail". The request goes back to the team. */
export async function replyWithDetail(db: Db, viewer: Viewer, id: string, reply: string) {
  const text = reply.trim().slice(0, 1200);
  if (!text) throw new Error("Write your reply first.");
  const r = await ownRequest(db, viewer, id);
  if (requestState(r) !== "needs_info") throw new Error("The team isn't waiting on you for this one.");
  await auditStatus(db, viewer, r, "awaiting_team", { reply: true });
  await db.query(`update request set detail_reply = $2, detail_replied_at = $3, unresolved_at = null where id = $1`, [id, text, now()]);
  await deliver(db, r.detail_asked_by ? [r.detail_asked_by] : await teamContact(db, r), {
    kind: "request_update",
    subject: `${viewer.user.name} replied with the detail you asked for`,
    body: `${r.title}\n\nYou asked: ${r.detail_question}\n\n${text}`,
    refs: [{ type: "request", id, href: "/asks?tab=team" }],
  });
}

/** Unresolved: send it to the team lead, who is told now and becomes its owner. */
export async function sendToLead(db: Db, viewer: Viewer, id: string) {
  const r = await ownRequest(db, viewer, id);
  if (requestState(r) !== "unresolved") throw new Error("You can send it to the lead once it has gone unanswered.");
  const lead = await db.one(
    `select m.id, m.user_id, a.name from member m join app_user a on a.id = m.user_id where m.unit_id = $1 and m.role = 'lead' limit 1`,
    [r.to_unit_id],
  );
  if (!lead) throw new Error(`${r.to_name} has no lead to send it to.`);
  await auditStatus(db, viewer, r, "awaiting_team", { sent_to_lead: lead.user_id });
  await db.query(
    `update request set assignee_member_id = $2, destination = 'owner', claimed_by = null, claimed_at = null, unresolved_at = null, escalated_at = $3,
       route_reason = $4, delivery = 'immediate', delivered_at = $3 where id = $1`,
    [id, lead.id, now(), `Sent to ${lead.name}, ${r.to_name}'s lead, after no reply in ${UNRESOLVED_AFTER_BUSINESS_DAYS} business days.`],
  );
  await deliver(db, [lead.user_id], {
    kind: "request_update",
    subject: `${viewer.user.name} needs an answer: no reply in ${UNRESOLVED_AFTER_BUSINESS_DAYS} business days`,
    body: `${r.title}\n\nAsked ${fmt(r.created_at)} and still open in ${r.to_name}'s queue.`,
    refs: [{ type: "request", id, href: "/asks" }],
  });
  return { lead: lead.name as string };
}

/** Unresolved: ask the same people again. The clock restarts and the team is reminded now. */
export async function askAgain(db: Db, viewer: Viewer, id: string) {
  const r = await ownRequest(db, viewer, id);
  if (requestState(r) !== "unresolved") throw new Error("You can ask again once it has gone unanswered.");
  await auditStatus(db, viewer, r, "awaiting_team", { asked_again: true });
  await db.query(`update request set unresolved_at = null, asked_again_at = $2 where id = $1`, [id, now()]);
  const to = r.destination === "team_queue" && !r.claimed_by
    ? (await db.query(`select user_id from member where unit_id = $1`, [r.to_unit_id])).map((m) => m.user_id as string)
    : await teamContact(db, r);
  await deliver(db, to.filter((u) => u !== viewer.user.id), {
    kind: "request_update",
    subject: `${viewer.user.name} is asking again`,
    body: `${r.title}\n\nAsked ${fmt(r.created_at)}, no reply yet.`,
    refs: [{ type: "request", id, href: r.destination === "team_queue" ? "/asks?tab=team" : "/asks" }],
  });
}
