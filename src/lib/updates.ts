import type { Db, Row } from "./db";
import { addDays, fmt, now, today } from "./clock";
import { ALL_KINDS, audit, loadPolicy, newId, refUpdateItem, teamMembers, type Viewer } from "./data";
import { deliver } from "./deliver";
import { confirmCommitment, rejectCommitment } from "./commitments";
import { assertWrite, PermissionError, visibleLevel, type Reader } from "./permissions";
import { showUpdateItem } from "./render";
import { splitUpdate, type TeamInfo } from "./ai/tasks";

export async function teamInfos(db: Db): Promise<TeamInfo[]> {
  const units = await db.query(`select id, name from unit where how_to_ask <> '{}'::jsonb order by name`);
  const owns = await db.query(`select unit_id, title, keywords from ownership_item`);
  return units.map((u) => ({
    id: u.id,
    name: u.name,
    owns: owns.filter((o) => o.unit_id === u.id).flatMap((o) => [o.title, ...o.keywords]),
  }));
}

/** Write update: AI splits the text into draft items and draft commitments. Nothing is shared yet. */
export async function analyzeUpdate(
  db: Db,
  viewer: Viewer,
  input: { unitId: string; text: string; source?: "manual" | "meeting" | "coding_agent" | "github" | "agent" },
): Promise<{ updateId: string; by: string }> {
  assertWrite(viewer.reader, input.unitId, "write this team's updates", { draft: true });
  if (!input.text.trim()) throw new Error("Write or paste an update first.");
  const openCommitments = await db.query<{ id: string; title: string; due_date: string; waiting_unit_id: string | null }>(
    `select id, title, due_date, waiting_unit_id from commitment where owner_unit_id = $1 and status = 'open' order by due_date`,
    [input.unitId],
  );
  const unit = await db.one(`select * from unit where id = $1`, [input.unitId]);
  const split = await splitUpdate({
    text: input.text,
    unitId: input.unitId,
    unitName: unit!.name,
    today: today(),
    teams: await teamInfos(db),
    openCommitments,
  });

  const updateId = newId("up");
  const authorMember = viewer.units.find((u) => u.id === input.unitId)?.member_id ?? null;
  await db.tx(async (t) => {
    await t.query(
      `insert into team_update (id, unit_id, author_id, period_start, body_md, source, status, created_at) values ($1, $2, $3, $4, $5, $6, 'draft', $7)`,
      [updateId, input.unitId, viewer.user.id, today(), input.text, input.source ?? "manual", now()],
    );
    const itemIds: string[] = [];
    for (const item of split.items) {
      const id = newId("ui");
      itemIds.push(id);
      await t.query(
        `insert into update_item (id, update_id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, status, source_kind, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11)`,
        [id, updateId, input.unitId, viewer.user.id, item.kind, item.text, item.summary, item.headline, item.affected_unit_ids, input.source ?? "manual", now()],
      );
    }
    for (const c of split.commitments) {
      await t.query(
        `insert into commitment (id, owner_unit_id, owner_member_id, waiting_unit_id, source_kind, source_id, title, due_date, original_due_date, status, revises_id, update_id, created_at)
         values ($1, $2, $3, $4, 'update_item', $5, $6, $7, $7, 'draft', $8, $9, $10)`,
        [newId("cm"), input.unitId, authorMember, c.waiting_unit_id, itemIds[c.item_index] ?? null, c.title, c.due_date, c.revises_commitment_id, updateId, now()],
      );
    }
  });
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "draft_update", targetKind: "update", targetId: updateId, detail: { items: split.items.length, commitments: split.commitments.length, by: split.by } });
  return { updateId, by: split.by };
}

export async function getDraft(db: Db, viewer: Viewer, updateId: string) {
  const update = await db.one(`select u.*, t.name as unit_name from team_update u join unit t on t.id = u.unit_id where u.id = $1`, [updateId]);
  if (!update) return null;
  if (update.author_id !== viewer.user.id) throw new PermissionError("Only the author can see a draft.");
  const items = await db.query(`select * from update_item where update_id = $1 order by created_at, id`, [updateId]);
  const commitments = await db.query(
    `select c.*, o.due_date as revises_due, o.title as revises_title, w.name as waiting_name, oa.name as owner_name, om.user_id as owner_user_id
     from commitment c left join commitment o on o.id = c.revises_id left join unit w on w.id = c.waiting_unit_id
     left join member om on om.id = c.owner_member_id left join app_user oa on oa.id = om.user_id
     where c.update_id = $1 order by c.created_at`,
    [updateId],
  );
  return { update, items, commitments };
}

export async function myDrafts(db: Db, viewer: Viewer): Promise<Row[]> {
  return db.query(
    `select u.*, t.name as unit_name, (select count(*)::int from update_item i where i.update_id = u.id) as item_count
     from team_update u join unit t on t.id = u.unit_id where u.author_id = $1 and u.status = 'draft' order by u.created_at desc`,
    [viewer.user.id],
  );
}

export interface PublishForm {
  items: { id: string; include: boolean; kind: string; text: string; summary: string; headline: string; affected: string[] }[];
  commitments: { id: string; confirm: boolean; title: string; due_date: string }[];
}

/** The author reviewed every item and tag. Publish, confirm commitments and notify affected teams. */
export async function publishDraft(db: Db, viewer: Viewer, updateId: string, form: PublishForm) {
  const draft = await getDraft(db, viewer, updateId);
  if (!draft) throw new Error("Draft not found");
  assertWrite(viewer.reader, draft.update.unit_id, "publish this team's updates");
  const at = now();
  for (const f of form.items) {
    const item = draft.items.find((i) => i.id === f.id);
    if (!item) continue;
    if (!f.include) {
      await db.query(`update update_item set status = 'discarded' where id = $1`, [f.id]);
      continue;
    }
    await db.query(
      `update update_item set status = 'published', kind = $2, text = $3, summary_text = $4, headline_text = $5, affected_unit_ids = $6, published_at = $7 where id = $1`,
      [f.id, f.kind, f.text, f.summary || f.text, f.headline || f.summary || f.text, f.affected, at],
    );
  }
  await db.query(`update team_update set status = 'published', published_at = $2 where id = $1`, [updateId, at]);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "publish_update", targetKind: "update", targetId: updateId, detail: { items: form.items.filter((i) => i.include).length } });

  const notified = await notifyAffected(db, updateId);
  const commitmentResults: { id: string; teams: string[]; people: number }[] = [];
  for (const c of form.commitments) {
    const row = draft.commitments.find((x) => x.id === c.id);
    if (!row) continue;
    if (row.owner_member_id && !viewer.units.some((u) => u.member_id === row.owner_member_id) && !row.revises_id) continue; // stays a draft for its owner
    if (c.confirm) {
      const r = await confirmCommitment(db, viewer, c.id, { title: c.title, due_date: c.due_date });
      commitmentResults.push({ id: c.id, ...r });
    } else {
      await rejectCommitment(db, viewer, c.id);
    }
  }
  return { notified, commitments: commitmentResults };
}

/**
 * Push, not pull: each affected team with an "immediate" interface gets the items now, at its level.
 * Daily and weekly interfaces are covered by the feed and digests.
 */
export async function notifyAffected(db: Db, updateId: string): Promise<{ unitId: string; people: number }[]> {
  const items = await db.query(`select i.*, u.name as unit_name, u.org_id from update_item i join unit u on u.id = i.unit_id where i.update_id = $1 and i.status = 'published'`, [updateId]);
  if (items.length === 0) return [];
  const orgId = items[0].org_id as string;
  const policy = await loadPolicy(db, orgId);
  const from = items[0].unit_id;
  const ifaces = await db.query(`select * from interface where from_unit_id = $1 and cadence = 'immediate'`, [from]);
  const out: { unitId: string; people: number }[] = [];
  for (const iface of ifaces) {
    const reader: Reader = { userId: `team:${iface.to_unit_id}`, unitIds: [iface.to_unit_id] };
    const lines = items
      .filter((i) => (i.affected_unit_ids as string[]).includes(iface.to_unit_id) && (iface.kinds as string[]).includes(i.kind))
      .map((i) => showUpdateItem(i, visibleLevel(policy, reader, refUpdateItem(i)).level))
      .filter(Boolean)
      .map((s) => `• ${s!.text}`);
    if (lines.length === 0) continue;
    const people = await teamMembers(db, [iface.to_unit_id]);
    const n = await deliver(db, people.map((p) => p.id), {
      kind: "update",
      subject: `${items[0].unit_name} posted ${lines.length === 1 ? "an update" : `${lines.length} updates`} that affect your team`,
      body: lines.join("\n"),
      refs: [{ type: "update", id: updateId, href: "/feed" }],
    });
    out.push({ unitId: iface.to_unit_id, people: n });
    await audit(db, { orgId, actorId: null, action: "share", targetKind: "update", targetId: updateId, detail: { to_unit: iface.to_unit_id, items: lines.length, level: iface.level } });
  }
  return out;
}

export async function latestUpdate(db: Db, unitId: string) {
  const u = await db.one(`select * from team_update where unit_id = $1 and status = 'published' order by published_at desc limit 1`, [unitId]);
  if (!u) return null;
  const items = await db.query(`select * from update_item where update_id = $1 and status = 'published' order by created_at, id`, [u.id]);
  return { update: u, items };
}

export async function recentItems(db: Db, unitId: string, weeks = 10): Promise<Row[]> {
  return db.query(
    `select * from update_item where unit_id = $1 and status = 'published' and published_at >= $2 order by published_at desc`,
    [unitId, addDays(today(), -7 * weeks)],
  );
}

export const kindsForInterfaces = ALL_KINDS;
export { fmt };
