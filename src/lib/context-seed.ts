// T-14: sample workspaces build their team context the way a real workspace does, by learning from
// the team's own activity, instead of shipping hand-written context. After a pack is seeded, this
// replays its history through learnFrom() in time order: what each team declared it owns, past
// answers, published updates, Slack messages, documents, pull requests and meeting summaries.
//
// It always uses the offline extractor, so resetting a demo never spends model calls and every
// visitor sees the same picture.
import type { Db } from "./db";
import type { DemoPack } from "./demos";
import { learnFrom, type LearnKind, type LearnSource } from "./context-learn";
import { scoped } from "./scoped";

interface Replay extends LearnSource {
  at: Date;
  /** Ownership a team declared: confirmed by its owner, like a team page a lead filled in. */
  confirmBy?: string;
  /** The owner's own description, which becomes the entry's details. */
  confirmBody?: string;
}

export async function seedContextByLearning(db: Db, pack: DemoPack): Promise<{ entries: number }> {
  const orgId = pack.id;
  const s = (local: string) => scoped(orgId, local);
  const out: Replay[] = [];

  // What each team says it owns. The first published update is when the team set up its page.
  const firstUpdate = await db.query(
    `select unit_id, min(published_at) as at from update_item where org_id = $1 and status = 'published' group by unit_id`,
    [orgId],
  );
  const setUpAt = new Map(firstUpdate.map((r) => [r.unit_id as string, new Date(r.at)]));
  const owns = await db.query(
    `select o.*, m.user_id, a.name as owner_name from ownership_item o left join member m on m.id = o.owner_member_id left join app_user a on a.id = m.user_id
      where o.unit_id in (select id from unit where org_id = $1)`,
    [orgId],
  );
  for (const o of owns) {
    out.push({
      unitId: o.unit_id, kind: "update", ref: `own:${o.id}`, label: `${o.owner_name ?? "The team"}'s team page`,
      text: `We own ${o.title}.`, at: setUpAt.get(o.unit_id) ?? new Date("2026-10-12T09:00:00Z"),
      confirmBy: o.user_id ?? undefined, confirmBody: o.description, actorId: o.user_id ?? undefined,
    });
  }

  // Past answers people gave to other teams' questions.
  for (const a of pack.answers ?? []) {
    const req = await db.one(`select id, to_unit_id, title, marking_id, status from request where id = $1`, [s(a.request)]);
    if (!req) continue;
    const by = await db.one(`select id, name from app_user where id = $1`, [s(a.by)]);
    await db.query(
      `update request set answer_text = $2, answered_by = $3, answered_at = $4, status = case when status = 'open' then 'answered' else status end where id = $1`,
      [req.id, a.text, by?.id ?? null, a.at],
    );
    out.push({
      unitId: req.to_unit_id, kind: "answer", ref: req.id, label: `${by?.name ?? "A teammate"}'s answer`, question: req.title, text: a.text,
      markingIds: req.marking_id ? [req.marking_id] : [], at: new Date(a.at), actorId: by?.id,
    });
  }

  // Published updates. Marked items keep their markings, so what's learned from them waits.
  const items = await db.query(
    `select i.id, i.unit_id, i.text, i.marking_id, i.published_at, a.name from update_item i join app_user a on a.id = i.author_id
      where i.org_id = $1 and i.status = 'published' and (i.max_level is null or i.max_level in ('full', 'summary'))`,
    [orgId],
  );
  for (const i of items) {
    out.push({ unitId: i.unit_id, kind: "update", ref: i.id, label: `${i.name}'s update`, text: i.text, markingIds: i.marking_id ? [i.marking_id] : [], at: new Date(i.published_at) });
  }

  // What the team's tools saw.
  const docs = await db.query(
    `select d.*, c.name as connector_name from source_doc d join connector c on c.id = d.connector_id where d.org_id = $1`,
    [orgId],
  );
  for (const d of docs) {
    const kind: LearnKind = d.kind === "pr" ? "pr" : d.kind === "message" ? "slack" : "source_doc";
    out.push({
      unitId: d.unit_id, kind, ref: d.id, label: d.kind === "pr" ? `${d.connector_name} ${d.external_ref ?? ""}`.trim() : d.title,
      text: d.kind === "pr" ? d.title : d.body, repo: d.kind === "pr" ? d.connector_name : undefined,
      markingIds: d.marking_id ? [d.marking_id] : [], at: new Date(d.occurred_at),
    });
  }

  // Meeting decisions and risks. Fewer people saw a meeting than see team context, so these wait.
  const meetings = await db.query(`select id, unit_id, title, summary, marking_id, starts_at from meeting where org_id = $1 and summary is not null`, [orgId]);
  for (const m of meetings) {
    const text = [...(m.summary.decisions ?? []), ...(m.summary.risks ?? [])].join(" ");
    if (text) out.push({ unitId: m.unit_id, kind: "meeting", ref: m.id, label: m.title, text, needsTeammate: true, markingIds: m.marking_id ? [m.marking_id] : [], at: new Date(m.starts_at) });
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  const seen = new Set<string>();
  for (const r of out) {
    const learned = await learnFrom(db, { ...r, offline: true });
    if (r.confirmBy) {
      for (const id of [...learned.created, ...learned.merged]) {
        await db.query(
          `update context_entry set provenance = 'team_confirmed', status = 'active', confidence = 0.95, confirmed_by = $2, confirmed_at = $3,
             body = coalesce($4, body) where id = $1 and provenance = 'learned'`,
          [id, r.confirmBy, r.at, r.confirmBody ?? null],
        );
      }
    }
    for (const id of [...learned.created, ...learned.merged]) seen.add(id);
  }
  return { entries: seen.size };
}
