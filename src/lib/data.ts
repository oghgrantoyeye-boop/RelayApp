import type { Db, Row } from "./db";
import { now } from "./clock";
import { isLevel, type ItemRef, type Policy, type Reader } from "./permissions";

export const ORG_ID = "northwind";
export const ITEM_KINDS = ["progress", "decision", "risk", "ask", "answer"] as const;
export const ALL_KINDS = [...ITEM_KINDS, "commitment", "request"];

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export async function loadPolicy(db: Db, orgId = ORG_ID): Promise<Policy> {
  const org = await db.one(`select settings from org where id = $1`, [orgId]);
  const interfaces = await db.query(
    `select i.* from interface i join unit u on u.id = i.from_unit_id where u.org_id = $1`,
    [orgId],
  );
  const markings = await db.query(`select * from marking where org_id = $1`, [orgId]);
  const def = org?.settings?.default_level;
  return {
    orgDefaultLevel: isLevel(def) ? def : "headline",
    interfaces: interfaces.map((i) => ({
      id: i.id,
      fromUnitId: i.from_unit_id,
      toUnitId: i.to_unit_id,
      kinds: i.kinds,
      level: i.level,
    })),
    markings: Object.fromEntries(
      markings.map((m) => [
        m.id,
        { id: m.id, label: m.label, allowedUnitIds: m.allowed_unit_ids, othersLevel: isLevel(m.others_level) ? m.others_level : "none" },
      ]),
    ),
  };
}

export interface Viewer {
  user: Row;
  reader: Reader;
  units: Row[];
  /** The team a person mainly works in (their first non-group team). */
  team: Row;
}

export async function loadViewer(db: Db, userId: string): Promise<Viewer | null> {
  const user = await db.one(`select * from app_user where id = $1`, [userId]);
  if (!user) return null;
  const units = await db.query(
    `select u.*, m.role, m.id as member_id from member m join unit u on u.id = m.unit_id where m.user_id = $1 order by (u.parent_unit_id is null), u.name`,
    [userId],
  );
  if (units.length === 0) return null;
  return {
    user,
    units,
    team: units[0],
    reader: { userId, unitIds: units.map((u) => u.id), isAgent: user.kind === "agent" },
  };
}

/** The team's agent, reading for someone: it never sees more than that person. */
export async function agentReader(db: Db, unitId: string, onBehalfOf: Reader): Promise<{ agent: Row; reader: Reader }> {
  const agent = await db.one(
    `select a.* from app_user a join member m on m.user_id = a.id where m.unit_id = $1 and a.kind = 'agent'`,
    [unitId],
  );
  if (!agent) throw new Error(`Team ${unitId} has no agent`);
  return { agent, reader: { userId: agent.id, unitIds: [unitId], isAgent: true, onBehalfOf } };
}

export const markingIdsOf = (row: Row): string[] => (row.marking_id ? [row.marking_id] : []);

export function refUpdateItem(row: Row): ItemRef {
  return {
    type: "update_item",
    kind: row.kind,
    ownerUnitIds: [row.unit_id],
    markingIds: markingIdsOf(row),
    draftVisibleTo: row.status === "draft" ? [row.author_id] : undefined,
    capLevel: row.max_level ?? undefined,
  };
}

export function refRequest(row: Row): ItemRef {
  return {
    type: "request",
    kind: "request",
    ownerUnitIds: [row.from_unit_id, row.to_unit_id],
    publisherUnitIds: [row.from_unit_id],
    markingIds: markingIdsOf(row),
  };
}

/** Commitment rows must be selected with the owner's user id as owner_user_id. */
export function refCommitment(row: Row): ItemRef {
  return {
    type: "commitment",
    kind: "commitment",
    ownerUnitIds: [row.owner_unit_id, row.waiting_unit_id].filter(Boolean),
    publisherUnitIds: [row.owner_unit_id],
    markingIds: markingIdsOf(row),
    draftVisibleTo: row.status === "draft" ? [row.owner_user_id].filter(Boolean) : undefined,
  };
}

export function refSource(row: Row): ItemRef {
  return { type: "source", kind: `source:${row.kind}`, ownerUnitIds: [row.unit_id], markingIds: markingIdsOf(row) };
}

/** A meeting: the host team and everyone who attended read it in full. */
export function refMeeting(row: Row): ItemRef {
  return { type: "meeting", kind: "meeting", ownerUnitIds: [row.unit_id], participantIds: row.attendee_ids ?? [], markingIds: markingIdsOf(row) };
}

/** An agent's task run: shared with the agent's whole team, and with whoever asked for it. */
export function refTask(row: Row): ItemRef {
  return { type: "task", kind: "task", ownerUnitIds: [row.unit_id], participantIds: [row.requested_by], markingIds: [] };
}

export const COMMITMENT_SELECT = `
  select c.*, om.user_id as owner_user_id, ou.name as owner_unit_name, ou.slug as owner_unit_slug, ou.color as owner_unit_color,
         wu.name as waiting_unit_name, wu.slug as waiting_unit_slug, wu.color as waiting_unit_color, oau.name as owner_name
  from commitment c
  join unit ou on ou.id = c.owner_unit_id
  left join unit wu on wu.id = c.waiting_unit_id
  left join member om on om.id = c.owner_member_id
  left join app_user oau on oau.id = om.user_id`;

export interface AuditInput {
  actorId: string | null;
  onBehalfOfId?: string | null;
  action: string;
  targetKind: string;
  targetId?: string | null;
  detail?: Record<string, unknown>;
}

export async function audit(db: Db, e: AuditInput, orgId = ORG_ID) {
  await db.query(
    `insert into audit_event (org_id, actor_id, on_behalf_of_id, action, target_kind, target_id, detail, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [orgId, e.actorId, e.onBehalfOfId ?? null, e.action, e.targetKind, e.targetId ?? null, JSON.stringify(e.detail ?? {}), now()],
  );
}

export async function unitMap(db: Db): Promise<Map<string, Row>> {
  const rows = await db.query(`select * from unit where org_id = $1`, [ORG_ID]);
  return new Map(rows.map((r) => [r.id, r]));
}

export async function teamMembers(db: Db, unitIds: string[]): Promise<Row[]> {
  if (unitIds.length === 0) return [];
  return db.query(
    `select distinct a.* from member m join app_user a on a.id = m.user_id where m.unit_id = any($1) and a.kind = 'human'`,
    [unitIds],
  );
}
