// The request lifecycle as the asker sees it (T-25, roadmap Phase 2 step 3).
//
// Stored statuses stay small: open, answered, accepted (answered with a commitment), declined and
// resolved. What the asker sees is derived from them and a few timestamps, so an open request stays
// in every team-queue query while it is awaiting the team, needs the asker's input or has gone
// unresolved. Every change of what the asker sees is written to the audit log as request_status.
import type { Db, Row } from "./db";
import { fmt, fmtDateTime, now } from "./clock";
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
      refs: [{ type: "request", id: r.id, href: `/questions?open=${r.id}` }],
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

// ---- My questions (T-26) ----

export type MyState = RequestState | "agent_answered" | "clarify";

export const MY_STATE: Record<MyState, { label: string; tone: "green" | "amber" | "red" | "blue" | "violet" | "gray" }> = {
  awaiting_team: { label: "Awaiting the team", tone: "amber" },
  needs_info: { label: "Needs your input", tone: "violet" },
  clarify: { label: "Needs your input", tone: "violet" },
  answered: { label: "Answered", tone: "green" },
  agent_answered: { label: "Answered by the agent", tone: "green" },
  resolved: { label: "Resolved", tone: "green" },
  declined: { label: "Declined", tone: "gray" },
  unresolved: { label: `No reply in ${UNRESOLVED_AFTER_BUSINESS_DAYS} days`, tone: "red" },
};

export interface Step {
  label: string;
  sub: string;
  done: boolean;
}

export interface MyQuestion {
  /** The request id when it was routed to people, otherwise the question id. */
  key: string;
  requestId: string | null;
  questionId: string | null;
  text: string;
  unitId: string;
  slug: string;
  team: string;
  /** Where it went, for the table: "Platform's queue", "Aisha Bello, Platform", "the Platform agent". */
  wentTo: string;
  /** Why it went there, in the router's words. */
  why: string | null;
  state: MyState;
  lastChange: Date;
  steps: Step[];
  reply: { by: string; text: string } | null;
  /** What the team or Beacon asked the asker, while it waits on them. */
  ask: string | null;
  clarifyOptions: string[];
  /** T-27: the other teams this same question went to. */
  alsoAsked: { team: string; slug: string }[];
}

const latest = (...vals: unknown[]) => new Date(Math.max(...vals.map(time)));

/**
 * Everything the viewer asked, newest change first: requests routed to people (from the agent or
 * the form) and questions the agent answered itself. Only the asker's own questions are listed.
 */
export async function myQuestions(db: Db, viewer: Viewer): Promise<MyQuestion[]> {
  const me = viewer.user.id;
  const reqs = await db.query(
    `select r.*, tu.name as to_name, tu.slug as to_slug, ow.name as owner_name, cl.name as claimer_name, ab.name as answerer_name,
            q.id as qid, q.parent_id as q_parent, q.group_id as q_group
       from request r join unit tu on tu.id = r.to_unit_id
       left join member om on om.id = r.assignee_member_id left join app_user ow on ow.id = om.user_id
       left join app_user cl on cl.id = r.claimed_by left join app_user ab on ab.id = r.answered_by
       left join question q on q.request_id = r.id
      where r.requester_id = $1 and r.org_id = $2`,
    [me, viewer.orgId],
  );
  const qs = await db.query(
    `select q.*, u.name as unit_name, u.slug as unit_slug,
            exists (select 1 from question c where c.parent_id = q.id) as has_follow_up
       from question q join unit u on u.id = q.unit_id
      where q.asker_id = $1 and q.org_id = $2 and q.request_id is null`,
    [me, viewer.orgId],
  );
  const out: MyQuestion[] = [];
  const groups = new Map<string, string | null>();

  for (const r of reqs) {
    const state = requestState(r);
    const queue = r.destination === "team_queue";
    const steps: Step[] = [{ label: "Asked", sub: fmtDateTimeShort(r.created_at), done: true }];
    const clarified = r.q_parent ? /\(([^()]+)\)\s*$/.exec(r.title)?.[1] ?? null : null;
    if (clarified) steps.push({ label: "Clarified", sub: clarified, done: true });
    steps.push(
      queue
        ? { label: `In ${r.to_name}'s queue`, sub: "No single owner", done: true }
        : { label: `Sent to ${r.owner_name ?? r.to_name}`, sub: r.to_name, done: true },
    );
    if (r.claimed_by) steps.push({ label: `${(r.claimer_name as string).split(" ")[0]} picked it up`, sub: fmtDateTimeShort(r.claimed_at), done: true });
    if (r.detail_asked_at) steps.push({ label: "Asked you for detail", sub: fmtDateTimeShort(r.detail_asked_at), done: true });
    if (r.detail_replied_at) steps.push({ label: "You replied", sub: fmtDateTimeShort(r.detail_replied_at), done: true });
    if (r.escalated_at) steps.push({ label: "Sent to the lead", sub: fmtDateTimeShort(r.escalated_at), done: true });
    if (state === "unresolved") steps.push({ label: `No reply in ${UNRESOLVED_AFTER_BUSINESS_DAYS} days`, sub: fmtDateTimeShort(r.unresolved_at), done: true });
    if (state === "declined") steps.push({ label: "Declined", sub: fmtDateTimeShort(r.answered_at), done: true });
    else steps.push({ label: "Answered", sub: r.answered_at ? fmtDateTimeShort(r.answered_at) : "Not yet", done: !!r.answered_at });
    if (state === "resolved") steps.push({ label: "Resolved", sub: fmtDateTimeShort(r.resolved_at), done: true });

    groups.set(r.id, r.q_group ?? null);
    out.push({
      alsoAsked: [],
      key: r.id,
      requestId: r.id,
      questionId: r.qid ?? null,
      text: r.title,
      unitId: r.to_unit_id,
      slug: r.to_slug,
      team: r.to_name,
      wentTo: queue ? `${r.to_name}'s queue` : `${r.owner_name ?? "The team"}, ${r.to_name}`,
      why: r.route_reason ?? null,
      state,
      lastChange: latest(r.created_at, r.claimed_at, r.detail_asked_at, r.detail_replied_at, r.unresolved_at, r.asked_again_at, r.escalated_at, r.answered_at, r.resolved_at),
      steps,
      reply: r.answer_text && (state === "answered" || state === "resolved" || state === "declined") ? { by: `${r.answerer_name ?? "The team"}, ${r.to_name}`, text: r.answer_text } : null,
      ask: state === "needs_info" ? r.detail_question : null,
      clarifyOptions: [],
    });
  }

  for (const q of qs) {
    if (q.outcome === "clarify" && q.has_follow_up) continue; // the follow-up is listed instead
    const clarify = q.outcome === "clarify";
    groups.set(q.id, q.group_id ?? null);
    out.push({
      alsoAsked: [],
      key: q.id,
      requestId: null,
      questionId: q.id,
      text: q.text,
      unitId: q.unit_id,
      slug: q.unit_slug,
      team: q.unit_name,
      wentTo: `The ${q.unit_name} agent`,
      why: null,
      state: clarify ? "clarify" : "agent_answered",
      lastChange: new Date(q.created_at),
      steps: clarify
        ? [{ label: "Asked", sub: fmtDateTimeShort(q.created_at), done: true }, { label: "Beacon asked what you meant", sub: "Waiting for you", done: true }]
        : [{ label: "Asked", sub: fmtDateTimeShort(q.created_at), done: true }, { label: `Answered by the ${q.unit_name} agent`, sub: fmtDateTimeShort(q.created_at), done: true }],
      reply: clarify ? null : { by: `The ${q.unit_name} agent`, text: q.answer_text },
      ask: clarify ? (q.clarify?.question ?? q.answer_text) : null,
      clarifyOptions: clarify ? (q.clarify?.options ?? []) : [],
    });
  }
  for (const q of out) {
    const g = groups.get(q.key);
    if (g) q.alsoAsked = out.filter((o) => o !== q && groups.get(o.key) === g).map((o) => ({ team: o.team, slug: o.slug }));
  }
  return out.sort((a, b) => b.lastChange.getTime() - a.lastChange.getTime());
}

function fmtDateTimeShort(v: unknown): string {
  return v ? fmtDateTime(new Date(v as string)) : "";
}
