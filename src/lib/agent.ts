// Team agents and requests (SPEC.md, "Team agents and requests"). The agent is each team's front
// door: it answers from what the team published, at the asker's level, and routes the rest to the
// person who owns that area. People get one batch of asks instead of separate messages.
import type { Db, Row } from "./db";
import { addDays, fmt, fmtDateTime, nextBatchAt, now, today } from "./clock";
import { agentReader, audit, loadPolicy, markingIdsOf, newId, refCommitment, refMeeting, refRequest, refSource, refUpdateItem, type Viewer } from "./data";
import { CONNECTOR_LABEL } from "./integrations";
import { deliver } from "./deliver";
import { COMMITMENT_SELECT } from "./data";
import { canSeeDerived, deriveMarkings, PermissionError, visibleLevel, type Level } from "./permissions";
import { showCommitment, showContext, showRequest, showSource, showUpdateItem, KIND_LABEL } from "./render";
import { answerFromPublished, routeQuestion, writeLevels } from "./ai/tasks";
import { jaccard, overlap, tokens, type Doc } from "./ai/offline";
import { notifyCommitmentChange } from "./commitments";
import { learnQuietly } from "./context-learn";
import { CONTEXT_KIND_LABEL, contextTag } from "./context";
import { refContext } from "./data";

export interface AskResult {
  questionId: string;
}

/**
 * Where a source's claim comes from, so an answer can say how sure it is:
 * the team said it (confirmed), Beacon learned it from the team's activity (learned),
 * or a tool recorded it (seen).
 */
export type SourceProvenance = "confirmed" | "learned" | "seen";

export interface Source extends Doc {
  markingIds: string[];
  level: Level;
  label: string;
  provenance: SourceProvenance;
  /** When the source was last true, as an ISO date: published, confirmed or last seen. */
  lastSeen: string;
  /** Where to read it: the team page (its "What Beacon knows" section for context) or the meeting. */
  href?: string;
}

const iso = (d: unknown): string => (d ? new Date(d as string).toISOString() : now().toISOString());

/** Everything the team has published that this asker may see, rendered at their level. */
async function publishedSources(db: Db, unitId: string, reader: Parameters<typeof visibleLevel>[1]): Promise<Source[]> {
  const unit = await db.one(`select org_id, slug from unit where id = $1`, [unitId]);
  if (!unit) return [];
  const policy = await loadPolicy(db, unit.org_id);
  const out: Source[] = [];
  const items = await db.query(
    `select * from update_item where unit_id = $1 and status = 'published' and published_at >= $2 order by published_at desc`,
    [unitId, addDays(today(), -84)],
  );
  for (const r of items) {
    const { level } = visibleLevel(policy, reader, refUpdateItem(r));
    const shown = showUpdateItem(r, level);
    if (!shown) continue;
    out.push({ ref: `update_item:${r.id}`, text: shown.text, markingIds: markingIdsOf(r), level, label: `${KIND_LABEL[r.kind]}, ${fmt(r.published_at)}`, provenance: "confirmed", lastSeen: iso(r.published_at) });
  }
  const commitments = await db.query(`${COMMITMENT_SELECT} where c.owner_unit_id = $1 and c.status in ('open', 'done')`, [unitId]);
  for (const c of commitments) {
    const { level } = visibleLevel(policy, reader, refCommitment(c));
    const shown = showCommitment(c, level, c.owner_unit_name);
    if (!shown) continue;
    const status = c.status === "done" ? "delivered" : c.due_date < today() ? `due ${fmt(c.due_date)}, not delivered yet` : `due ${fmt(c.due_date)}`;
    out.push({ ref: `commitment:${c.id}`, text: `Commitment: ${shown.title} (${status}).${shown.reason ? ` ${shown.reason}` : ""}`, markingIds: markingIdsOf(c), level, label: "Commitment", provenance: "confirmed", lastSeen: iso(c.done_at ?? c.confirmed_at ?? c.created_at) });
  }
  const owns = await db.query(`select o.*, a.name as owner_name from ownership_item o left join member m on m.id = o.owner_member_id left join app_user a on a.id = m.user_id where o.unit_id = $1`, [unitId]);
  for (const o of owns) {
    out.push({ ref: `ownership:${o.id}`, text: `${o.title}: ${o.description}. Owner: ${o.owner_name}.`, markingIds: [], level: "headline", label: "Owns", provenance: "confirmed", lastSeen: iso(o.created_at) });
  }
  // Learned team context. Only active entries: a pending claim waits for a teammate and is never
  // used to answer anyone, and a removed one is gone. The level comes from the same permission check.
  const context = await db.query(`select * from context_entry where unit_id = $1 and status = 'active' order by last_seen_at desc limit 60`, [unitId]);
  for (const e of context) {
    const { level } = visibleLevel(policy, reader, refContext(e));
    const shown = showContext(e, level);
    if (!shown) continue;
    const tag = contextTag(e);
    out.push({
      ref: `context:${e.id}`,
      text: `${CONTEXT_KIND_LABEL[e.kind] ?? e.kind}: ${shown.title}${shown.body ? `. ${shown.body}` : ""}`,
      markingIds: e.marking_ids ?? [],
      level,
      label: tag === "confirmed" ? "Confirmed by the team" : tag === "seen" ? "Seen in tools" : "Learned",
      provenance: tag,
      lastSeen: iso(tag === "confirmed" ? e.confirmed_at ?? e.last_seen_at : e.last_seen_at),
    });
  }
  // Connected tools: raw chat stays inside the team; tickets and docs reach others only if an interface shares them.
  const docs = await db.query(
    `select d.*, c.kind as connector_kind, c.name as connector_name from source_doc d join connector c on c.id = d.connector_id where d.unit_id = $1 and d.occurred_at >= $2 order by d.occurred_at desc`,
    [unitId, addDays(today(), -60)],
  );
  for (const d of docs) {
    const { level } = visibleLevel(policy, reader, refSource(d));
    const shown = showSource(d, level);
    if (!shown) continue;
    out.push({
      ref: `source:${d.id}`,
      text: `${shown.title}${shown.status ? ` (${shown.status})` : ""}${shown.text ? `: ${shown.text}` : ""}`,
      markingIds: markingIdsOf(d),
      level,
      label: `${CONNECTOR_LABEL[d.connector_kind] ?? d.connector_kind}, ${fmt(d.occurred_at)}`,
      provenance: "seen",
      lastSeen: iso(d.occurred_at),
    });
  }
  // Meeting summaries: only for the host team and the people who attended.
  const meetings = await db.query(`select * from meeting where unit_id = $1 and summary is not null`, [unitId]);
  for (const m of meetings) {
    const { level } = visibleLevel(policy, reader, refMeeting(m));
    if (level !== "full") continue;
    const s = m.summary as { summary: string; decisions: string[] };
    out.push({ ref: `meeting:${m.id}`, text: `${m.title}: ${s.summary} ${(s.decisions ?? []).join(" ")}`, markingIds: markingIdsOf(m), level, label: `Meeting, ${fmt(m.starts_at)}`, provenance: "learned", lastSeen: iso(m.starts_at) });
  }
  const page = `/teams/${unit.slug}`;
  return out.map((src) => ({
    ...src,
    href: src.ref.startsWith("meeting:") ? `/meetings/${src.ref.slice(8)}` : src.ref.startsWith("context:") ? `${page}#knows` : page,
  }));
}

async function ownerFor(db: Db, unitId: string, question: string): Promise<{ ownership: Row | null; member: Row }> {
  const owns = await db.query(`select * from ownership_item where unit_id = $1`, [unitId]);
  const id = routeQuestion(question, owns.map((o) => ({ id: o.id, title: o.title, description: o.description, keywords: o.keywords })));
  const ownership = owns.find((o) => o.id === id) ?? null;
  const member = ownership?.owner_member_id
    ? await db.one(`select m.*, a.name, a.ask_cadence from member m join app_user a on a.id = m.user_id where m.id = $1`, [ownership.owner_member_id])
    : await db.one(`select m.*, a.name, a.ask_cadence from member m join app_user a on a.id = m.user_id where m.unit_id = $1 and m.role = 'lead'`, [unitId]);
  if (!member) throw new Error("This team has no lead to route to");
  return { ownership, member };
}

/** Requests that ask the same thing of the same person share a cluster and get one answer. */
export async function clusterKeyFor(db: Db, assigneeMemberId: string, text: string, ownershipId: string | null): Promise<string> {
  const open = await db.query(`select id, title, cluster_key, ownership_item_id from request where assignee_member_id = $1 and status = 'open'`, [assigneeMemberId]);
  const words = tokens(text);
  let best: { key: string; score: number } | null = null;
  for (const r of open) {
    const t = tokens(r.title);
    const score = overlap(words, t) + jaccard(words, t) + (ownershipId && r.ownership_item_id === ownershipId ? 0.5 : 0);
    if ((overlap(words, t) >= 2 || jaccard(words, t) >= 0.3) && (!best || score > best.score)) best = { key: r.cluster_key ?? r.id, score };
  }
  return best?.key ?? `ck_${newId("c").slice(2)}`;
}

/** Ask a team's agent. It answers from published material, or routes the question to a person. */
export async function askTeam(db: Db, viewer: Viewer, unitId: string, text: string, opts: { blocking?: boolean; neededBy?: string } = {}): Promise<AskResult> {
  const question = text.trim();
  if (!question) throw new Error("Type a question first.");
  const unit = await db.one(`select * from unit where id = $1`, [unitId]);
  if (!unit) throw new Error("Team not found");
  const { agent, reader } = await agentReader(db, unitId, viewer.reader);
  const sources = await publishedSources(db, unitId, reader);
  await audit(db, { orgId: viewer.orgId,
    actorId: agent.id,
    onBehalfOfId: viewer.user.id,
    action: "agent_read",
    targetKind: "unit",
    targetId: unitId,
    detail: { sources: sources.length, levels: Object.fromEntries(sources.map((s) => [s.ref, s.level])) },
  });

  const result = await answerFromPublished({ question, teamName: unit.name, today: today(), sources });
  const qid = newId("qn");
  if (result.answered) {
    const used = sources.filter((s) => result.source_refs.includes(s.ref));
    const markings = deriveMarkings(used);
    await db.query(
      `insert into question (id, org_id, asker_id, unit_id, text, outcome, answer_text, source_refs, marking_ids, claims, gaps, created_at) values ($1, $2, $3, $4, $5, 'answered', $6, $7, $8, $9, $10, $11)`,
      [qid, unit.org_id, viewer.user.id, unitId, question, result.answer, JSON.stringify(used.map((u) => u.ref)), markings, JSON.stringify(result.claims), JSON.stringify(result.gaps), now()],
    );
    await audit(db, { orgId: viewer.orgId, actorId: agent.id, onBehalfOfId: viewer.user.id, action: "agent_answer", targetKind: "question", targetId: qid, detail: { sources: used.map((u) => u.ref), markings, by: result.by } });
    return { questionId: qid };
  }

  // Not in what the team published: route it to the person who owns the area.
  const { ownership, member } = await ownerFor(db, unitId, question);
  const cluster = await clusterKeyFor(db, member.id, question, ownership?.id ?? null);
  const nextBatch = nextBatchAt(member.ask_cadence);
  const immediate = !!opts.blocking || (!!opts.neededBy && opts.neededBy <= nextBatch.toISOString().slice(0, 10)) || member.ask_cadence === "immediate";
  const reqId = newId("rq");
  await db.query(
    `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, needed_by, urgency, status, ownership_item_id, assignee_member_id, cluster_key, via, delivery, delivered_at, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10, $11, $12, 'agent', $13, $14, $15)`,
    [reqId, unit.org_id, viewer.team.id, unitId, viewer.user.id, question, `Asked the ${unit.name} agent.`, opts.neededBy || null,
      opts.blocking ? "blocking" : "normal", ownership?.id ?? null, member.id, cluster, immediate ? "immediate" : "batch", immediate ? now() : null, now()],
  );
  const askers = (await db.one(`select count(distinct requester_id)::int as n from request where cluster_key = $1 and status = 'open'`, [cluster]))!.n;
  if (immediate) {
    await deliver(db, [member.user_id], {
      kind: "ask_now",
      subject: `${opts.blocking ? "Blocking ask" : "Ask needed soon"} from ${viewer.user.name}`,
      body: `${question}${opts.neededBy ? ` (needed by ${fmt(opts.neededBy)})` : ""}`,
      refs: [{ type: "request", id: reqId, href: "/asks" }],
    });
  }
  const who = `${member.name}${ownership ? `, who owns ${ownership.title}` : `, the team lead`}`;
  const when = immediate ? "They've been notified now." : `It's in their next batch of asks (${fmtDateTime(nextBatch)} UTC), so they can answer everyone at once.`;
  const others = askers > 1 ? ` ${askers - 1} other ${askers - 1 === 1 ? "person has" : "people have"} asked the same thing.` : "";
  const partial = result.partial ? sources.find((s) => s.ref === result.partial!.ref) : undefined;
  const answer = `${unit.name} hasn't published an answer to this yet. I sent it to ${who}.${others} ${when}`;
  const markings = partial ? deriveMarkings([partial]) : [];
  await db.query(
    `insert into question (id, org_id, asker_id, unit_id, text, outcome, answer_text, source_refs, marking_ids, request_id, gaps, created_at) values ($1, $2, $3, $4, $5, 'routed', $6, $7, $8, $9, $10, $11)`,
    [qid, unit.org_id, viewer.user.id, unitId, question, answer, JSON.stringify(partial ? [partial.ref] : []), markings, reqId, JSON.stringify(result.gaps), now()],
  );
  await audit(db, { orgId: viewer.orgId,
    actorId: agent.id,
    onBehalfOfId: viewer.user.id,
    action: "agent_route",
    targetKind: "request",
    targetId: reqId,
    detail: { to: member.user_id, ownership: ownership?.id ?? null, cluster, delivery: immediate ? "immediate" : "batch", by: result.by },
  });
  return { questionId: qid };
}

export async function getQuestion(db: Db, viewer: Viewer, id: string) {
  const q = await db.one(`select q.*, u.name as unit_name from question q join unit u on u.id = q.unit_id where q.id = $1`, [id]);
  if (!q) return null;
  // An answer is a derived output: only its asker sees it, and only if its markings still allow them.
  const policy = await loadPolicy(db, viewer.orgId);
  if (q.asker_id !== viewer.user.id || !canSeeDerived(policy, viewer.reader, q.marking_ids)) return null;
  const refs: string[] = q.source_refs ?? [];
  const sources = (await publishedSourcesFor(db, q.unit_id, viewer)).filter((s) => refs.includes(s.ref));
  return { question: q, sources, claims: claimViews(q.claims ?? [], sources), gaps: (q.gaps ?? []) as string[] };
}

export type ClaimTag = SourceProvenance | "inference";

export interface ClaimView {
  text: string;
  tag: ClaimTag;
  /** "Confirmed by the team", "Seen in tools": what kind of basis the claim has. */
  basis: string;
  /** When its newest source was last true, ISO. Absent for inference. */
  date?: string;
  /** Its newest source is older than STALE_SOURCE_DAYS, so it may be out of date. */
  stale: boolean;
  source?: { label: string; text: string; href?: string };
}

/** Sources not seen for this long are flagged in an answer. */
export const STALE_SOURCE_DAYS = 90;

/**
 * Each claim with its tag, date and source, from the sources this viewer may still see. A claim
 * whose sources the viewer can no longer see is dropped rather than shown without its basis.
 */
export function claimViews(claims: { text: string; refs: string[] }[], sources: Source[]): ClaimView[] {
  const byRef = new Map(sources.map((s) => [s.ref, s]));
  const staleBefore = now().getTime() - STALE_SOURCE_DAYS * 86_400_000;
  const rank: Record<SourceProvenance, number> = { confirmed: 0, seen: 1, learned: 2 };
  const out: ClaimView[] = [];
  for (const c of claims) {
    if (c.refs.length === 0) {
      out.push({ text: c.text, tag: "inference", basis: "Beacon's inference", stale: false });
      continue;
    }
    const used = c.refs.map((r) => byRef.get(r)).filter((s): s is Source => !!s);
    if (used.length === 0) continue;
    // The strongest source decides the tag: something the team confirmed beats something learned.
    const best = [...used].sort((a, b) => rank[a.provenance] - rank[b.provenance])[0];
    const newest = used.map((s) => s.lastSeen).sort().at(-1)!;
    const basis = best.provenance === "confirmed" ? "Confirmed by the team" : best.provenance === "seen" ? "Seen in tools" : "Learned from the team's activity";
    out.push({ text: c.text, tag: best.provenance, basis, date: newest, stale: Date.parse(newest) < staleBefore, source: { label: best.label, text: best.text, href: best.href } });
  }
  return out;
}

/** What a team's agent may draw on when this viewer asks it something. */
export async function publishedSourcesFor(db: Db, unitId: string, viewer: Viewer) {
  const { reader } = await agentReader(db, unitId, viewer.reader);
  return publishedSources(db, unitId, reader);
}

export async function agentStats(db: Db, unitId: string) {
  const r = await db.one(
    `select count(*)::int as total, count(*) filter (where outcome = 'answered')::int as answered from question where unit_id = $1 and created_at >= $2`,
    [unitId, addDays(today(), -30)],
  );
  return { total: r?.total ?? 0, answered: r?.answered ?? 0 };
}

export interface AskCluster {
  key: string;
  title: string;
  details?: string;
  level: Level;
  restricted: string | null;
  requests: Row[];
  askers: { name: string; team: string }[];
  urgent: boolean;
  neededBy: string | null;
  delivered: boolean;
  ownership: string | null;
  firstAsked: Date;
}

/** A person's asks: open requests assigned to them, duplicates merged, urgent first. */
export async function getAsks(db: Db, viewer: Viewer): Promise<{ clusters: AskCluster[]; nextBatch: Date; pending: number }> {
  const policy = await loadPolicy(db, viewer.orgId);
  const rows = await db.query(
    `select r.*, a.name as requester_name, fu.name as from_name, tu.name as to_name, o.title as ownership_title, mk.label as marking_label
     from request r
     join member m on m.id = r.assignee_member_id
     join app_user a on a.id = r.requester_id
     join unit fu on fu.id = r.from_unit_id
     join unit tu on tu.id = r.to_unit_id
     left join ownership_item o on o.id = r.ownership_item_id
     left join marking mk on mk.id = r.marking_id
     where m.user_id = $1 and r.status = 'open'
     order by r.created_at`,
    [viewer.user.id],
  );
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.cluster_key ?? r.id;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const clusters: AskCluster[] = [];
  for (const [key, reqs] of groups) {
    const first = reqs[0];
    const { level } = visibleLevel(policy, viewer.reader, refRequest(first));
    const shown = showRequest(first, level, { from: first.from_name, to: first.to_name });
    if (!shown) continue;
    const today0 = today();
    const neededBy = reqs.map((r) => r.needed_by).filter(Boolean).sort()[0] ?? null;
    clusters.push({
      key,
      title: shown.title,
      details: shown.details,
      level,
      restricted: level !== "full" ? first.marking_label ?? null : null,
      requests: reqs,
      askers: reqs.map((r) => ({ name: r.requester_name, team: r.from_name })),
      urgent: reqs.some((r) => r.urgency === "blocking") || (!!neededBy && neededBy <= addDays(today0, 2)),
      neededBy,
      delivered: reqs.every((r) => r.delivered_at),
      ownership: first.ownership_title,
      firstAsked: first.created_at,
    });
  }
  clusters.sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.askers.length - a.askers.length || +a.firstAsked - +b.firstAsked);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "read_asks", targetKind: "asks", targetId: viewer.user.id, detail: { clusters: clusters.length, requests: rows.length } });
  return { clusters, nextBatch: nextBatchAt(viewer.user.ask_cadence), pending: rows.filter((r) => !r.delivered_at).length };
}

async function clusterRequests(db: Db, viewer: Viewer, key: string): Promise<Row[]> {
  const reqs = await db.query(
    `select r.*, m.user_id as assignee_user_id, tu.name as to_name from request r join member m on m.id = r.assignee_member_id join unit tu on tu.id = r.to_unit_id
     where (r.cluster_key = $1 or r.id = $1) and r.status = 'open'`,
    [key],
  );
  if (reqs.length === 0) throw new Error("Nothing open to answer here.");
  if (!reqs.every((r) => r.assignee_user_id === viewer.user.id || viewer.reader.unitIds.includes(r.to_unit_id)))
    throw new PermissionError("Only the team these asks were sent to can answer them.");
  return reqs;
}

/** Answer once: the reply goes to everyone who asked. Optionally publish it so the agent can answer next time. */
export async function answerCluster(
  db: Db,
  viewer: Viewer,
  key: string,
  input: { answer: string; publish?: boolean; publishLevel?: Level; commitDue?: string },
) {
  const answer = input.answer.trim();
  if (!answer) throw new Error("Write an answer first.");
  const reqs = await clusterRequests(db, viewer, key);
  const unitId = reqs[0].to_unit_id;
  for (const r of reqs) {
    await db.query(`update request set status = $2, answer_text = $3, answered_by = $4, answered_at = $5 where id = $1`, [
      r.id, input.commitDue ? "accepted" : "answered", answer, viewer.user.id, now(),
    ]);
  }
  const askers = [...new Set(reqs.map((r) => r.requester_id))];
  await deliver(db, askers, {
    kind: "answer",
    subject: `${viewer.user.name} (${reqs[0].to_name}) answered your question`,
    body: `You asked: ${reqs[0].title}\n\n${answer}`,
    refs: [{ type: "request", id: reqs[0].id, href: "/inbox" }],
  });
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "answer_request", targetKind: "request", targetId: reqs[0].id, detail: { cluster: key, recipients: askers.length } });
  // What the team says when it answers is the best evidence of what it knows and how it works.
  await learnQuietly(db, {
    unitId,
    kind: "answer",
    ref: reqs[0].id,
    label: `${viewer.user.name}'s answer`,
    question: reqs[0].title,
    text: answer,
    markingIds: [...new Set(reqs.map((r) => r.marking_id).filter(Boolean))] as string[],
    actorId: viewer.user.id,
  });

  let publishedId: string | null = null;
  if (input.publish) {
    const marking = reqs.find((r) => r.marking_id)?.marking_id ?? null;
    const text = `${reqs[0].title.replace(/\?*$/, "?")} ${answer}`;
    const { summary, headline } = await writeLevels(text, `An answer from ${reqs[0].to_name} to a common question.`, { answer });
    publishedId = newId("ui");
    await db.query(
      `insert into update_item (id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, marking_id, max_level, status, source_kind, source_ref, created_at, published_at)
       values ($1, $2, $3, 'answer', $4, $5, $6, $7, $8, $9, 'published', 'answer', $10, $11, $11)`,
      [publishedId, unitId, viewer.user.id, text, summary, headline, [...new Set(reqs.map((r) => r.from_unit_id))], marking,
        input.publishLevel && input.publishLevel !== "full" ? input.publishLevel : null, reqs[0].id, now()],
    );
    await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "publish_answer", targetKind: "update_item", targetId: publishedId, detail: { cap: input.publishLevel ?? null } });
  }

  let commitmentId: string | null = null;
  if (input.commitDue) {
    commitmentId = newId("cm");
    const member = viewer.units.find((u) => u.id === unitId)?.member_id ?? null;
    await db.query(
      `insert into commitment (id, owner_unit_id, owner_member_id, waiting_unit_id, source_kind, source_id, title, due_date, original_due_date, status, confirmed_at, marking_id, created_at)
       values ($1, $2, $3, $4, 'request', $5, $6, $7, $7, 'open', $8, $9, $8)`,
      [commitmentId, unitId, member, reqs[0].from_unit_id, reqs[0].id, reqs[0].title.replace(/\?$/, ""), input.commitDue, now(), reqs[0].marking_id],
    );
    await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "accept_request", targetKind: "commitment", targetId: commitmentId, detail: { due: input.commitDue } });
    await notifyCommitmentChange(db, commitmentId, (shown) => ({ subject: `${reqs[0].to_name} committed to ${fmt(input.commitDue!)}`, body: `${shown.title}, due ${fmt(input.commitDue!)}.` }));
  }
  return { recipients: askers.length, publishedId, commitmentId };
}

export async function declineCluster(db: Db, viewer: Viewer, key: string, reason: string) {
  const reqs = await clusterRequests(db, viewer, key);
  for (const r of reqs) await db.query(`update request set status = 'declined', answer_text = $2, answered_by = $3, answered_at = $4 where id = $1`, [r.id, reason || "Declined", viewer.user.id, now()]);
  await deliver(db, [...new Set(reqs.map((r) => r.requester_id))], {
    kind: "answer",
    subject: `${reqs[0].to_name} declined your request`,
    body: `${reqs[0].title}\n\n${reason || "No reason given."}`,
  });
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "decline_request", targetKind: "request", targetId: reqs[0].id, detail: { cluster: key } });
}

/** Send this person their batch now: one message listing what people want from them. */
export async function sendBatch(db: Db, viewer: Viewer) {
  const { clusters } = await getAsks(db, viewer);
  const pending = clusters.filter((c) => !c.delivered);
  if (pending.length === 0) return { sent: 0 };
  const lines = pending.map((c) => {
    const who = c.askers.length > 1 ? `${c.askers.length} people asked` : `${c.askers[0].name} (${c.askers[0].team}) asked`;
    return `• ${who}: ${c.title}${c.urgent ? " [urgent]" : ""}`;
  });
  await deliver(db, [viewer.user.id], {
    kind: "ask_batch",
    subject: `Your asks for ${fmt(now())}: ${pending.length} ${pending.length === 1 ? "thing" : "things"} people need from you`,
    body: lines.join("\n"),
    refs: [{ type: "asks", id: viewer.user.id, href: "/asks" }],
  });
  for (const c of pending) for (const r of c.requests) await db.query(`update request set delivered_at = $2 where id = $1`, [r.id, now()]);
  await db.query(`update app_user set last_batch_at = $2 where id = $1`, [viewer.user.id, now()]);
  await audit(db, { orgId: viewer.orgId, actorId: null, action: "send_batch", targetKind: "user", targetId: viewer.user.id, detail: { clusters: pending.length } });
  return { sent: pending.length };
}

/** A request through a team's "how to ask us" form, routed the same way as agent questions. */
export async function submitRequest(db: Db, viewer: Viewer, unitId: string, input: { title: string; details: string; neededBy?: string; blocking?: boolean }) {
  if (!input.title.trim()) throw new Error("Say what you need.");
  if (viewer.reader.unitIds.includes(unitId)) throw new Error("This form is for other teams.");
  const unit = await db.one(`select * from unit where id = $1`, [unitId]);
  const { ownership, member } = await ownerFor(db, unitId, `${input.title} ${input.details}`);
  const cluster = await clusterKeyFor(db, member.id, input.title, ownership?.id ?? null);
  const nextBatch = nextBatchAt(member.ask_cadence);
  const immediate = !!input.blocking || (!!input.neededBy && input.neededBy <= nextBatch.toISOString().slice(0, 10));
  const id = newId("rq");
  await db.query(
    `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, needed_by, urgency, status, ownership_item_id, assignee_member_id, cluster_key, via, delivery, delivered_at, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10, $11, $12, 'form', $13, $14, $15)`,
    [id, unit!.org_id, viewer.team.id, unitId, viewer.user.id, input.title.trim(), input.details.trim(), input.neededBy || null,
      input.blocking ? "blocking" : "normal", ownership?.id ?? null, member.id, cluster, immediate ? "immediate" : "batch", immediate ? now() : null, now()],
  );
  if (immediate)
    await deliver(db, [member.user_id], { kind: "ask_now", subject: `${input.blocking ? "Blocking ask" : "Ask needed soon"} from ${viewer.user.name}`, body: input.title, refs: [{ type: "request", id, href: "/asks" }] });
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "create_request", targetKind: "request", targetId: id, detail: { to: member.user_id, delivery: immediate ? "immediate" : "batch" } });
  return { id, assignee: member.name, ownership: ownership?.title ?? null, immediate, nextBatch };
}
