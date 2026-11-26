import type { Db } from "./db";
import type { Level } from "./levels";
import {
  type EntityRef,
  type Field,
  type PermissionContext,
  canSeeEntity,
  canWrite,
  loadPermissionContext,
  markingsFor,
  visibleLevel,
} from "./permissions";
import { type Rendered, renderField } from "./render";

import { ENTITY_TYPE, EXTERNAL_OWNER_FIELD } from "./seed";

export { ENTITY_TYPE };

export class PermissionError extends Error {}

/**
 * The demo is set on a fixed date in 2027, so new events are stamped just after
 * the latest one instead of with the real clock, which keeps feeds in order.
 */
const DEMO_CLOCK = "(select coalesce(max(at), now()) + interval '1 minute' from audit_event)";

export interface RawEntity {
  ref: EntityRef;
  external_ref: string;
  revision: number;
  values: Map<string, unknown>; // field id -> raw value; never returned to callers
}

export async function loadRaw(db: Db, ctx: PermissionContext, externalRef: string): Promise<RawEntity | null> {
  const e = await db.query<{ id: string; revision: number }>(
    "select id, revision from entity where external_ref = $1",
    [externalRef],
  );
  if (!e.rows[0]) return null;
  const { id, revision } = e.rows[0];
  const vals = await db.query<{ field_id: string; value_json: unknown }>(
    "select field_id, value_json from field_value where entity_id = $1",
    [id],
  );
  const values = new Map(vals.rows.map((r) => [r.field_id, r.value_json]));
  const owner = values.get(ctx.fieldsByKey.get(EXTERNAL_OWNER_FIELD)?.id ?? "") as { member_id?: string } | undefined;
  return { ref: { id, external_owner_id: owner?.member_id ?? null }, external_ref: externalRef, revision, values };
}

/** Every entity's raw values, for server-side aggregation. Callers must check levels before using a value. */
export async function loadAllRaw(db: Db, ctx: PermissionContext): Promise<RawEntity[]> {
  const ents = await db.query<{ id: string; external_ref: string; revision: number }>(
    "select id, external_ref, revision from entity order by external_ref",
  );
  const vals = await db.query<{ entity_id: string; field_id: string; value_json: unknown }>(
    "select entity_id, field_id, value_json from field_value",
  );
  const byEntity = new Map<string, Map<string, unknown>>();
  for (const v of vals.rows) {
    if (!byEntity.has(v.entity_id)) byEntity.set(v.entity_id, new Map());
    byEntity.get(v.entity_id)!.set(v.field_id, v.value_json);
  }
  const ownerField = ctx.fieldsByKey.get(EXTERNAL_OWNER_FIELD)?.id ?? "";
  return ents.rows.map((e) => {
    const values = byEntity.get(e.id) ?? new Map();
    const owner = values.get(ownerField) as { member_id?: string } | undefined;
    return { ref: { id: e.id, external_owner_id: owner?.member_id ?? null }, external_ref: e.external_ref, revision: e.revision, values };
  });
}

/** The level a whole unit receives a field at (public units: only for the entity's own partner). */
export function unitLevel(ctx: PermissionContext, unitId: string, entity: EntityRef, field: Field): { level: Level; memberId: string | null } {
  const unit = ctx.units.get(unitId);
  const member =
    unit?.kind === "public"
      ? entity.external_owner_id
      : ([...ctx.members.values()].find((m) => m.unit_id === unitId && m.kind === "person")?.id ?? null);
  if (!member) return { level: "none", memberId: null };
  return { level: visibleLevel(ctx, member, entity, field), memberId: unit?.kind === "public" ? member : null };
}

/**
 * Push, not pull: when a field changes, every active interface on it whose
 * trigger matches writes a share event to the receiving unit's feed. The
 * event holds only the text rendered at the level that unit is allowed.
 */
export async function shareOnTrigger(
  db: Db,
  ctx: PermissionContext,
  raw: RawEntity,
  field: Field,
  trigger: string,
  actor: string | null,
  at?: string,
): Promise<number> {
  const ifaces = await db.query<{ id: string; to_unit_id: string; trigger: string }>(
    "select id, to_unit_id, trigger from interface where field_id = $1 and status = 'active'",
    [field.id],
  );
  const name = renderField("text", raw.values.get(ctx.fieldsByKey.get("name")?.id ?? ""), "full").text ?? raw.external_ref;
  let n = 0;
  for (const i of ifaces.rows) {
    if (!i.trigger.split("+").includes(trigger)) continue;
    const { level, memberId } = unitLevel(ctx, i.to_unit_id, raw.ref, field);
    if (level === "none") continue;
    const r = renderField(field.type, raw.values.get(field.id), level);
    if (!r.text) continue;
    await db.query(
      `insert into audit_event (actor_member_id, action, target, to_unit_id, detail, at)
       values ($1, 'share', $2, $3, $4, coalesce($5::timestamptz, ${DEMO_CLOCK}))`,
      [
        actor,
        raw.external_ref,
        i.to_unit_id,
        JSON.stringify({
          interface: i.id,
          entity_name: name,
          field: field.key,
          field_label: field.label,
          from_unit: field.owner_unit_id,
          level,
          text: r.text,
          markings: markingsFor(ctx, raw.ref, field).map((m) => m.label),
          ...(memberId ? { member: memberId } : {}),
        }),
        at ?? null,
      ],
    );
    n++;
  }
  return n;
}

export interface ReadOptions {
  /** Set when an agent reads for a person. Both are logged. */
  onBehalfOf?: string | null;
  /** Restrict the read to these field keys. */
  keys?: string[];
}

export interface FieldView extends Rendered {
  key: string;
  label: string;
  type: string;
  owner_unit_id: string;
  markings: string[];
}

export interface EntityView {
  external_ref: string;
  revision: number;
  fields: Record<string, FieldView>;
}

export async function audit(
  db: Db,
  e: {
    actor: string | null;
    onBehalfOf?: string | null;
    action: string;
    target: string;
    toUnit?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  await db.query(
    `insert into audit_event (actor_member_id, on_behalf_of_member_id, action, target, to_unit_id, detail, at)
     values ($1, $2, $3, $4, $5, $6, ${DEMO_CLOCK})`,
    [e.actor, e.onBehalfOf ?? null, e.action, e.target, e.toUnit ?? null, JSON.stringify(e.detail ?? {})],
  );
}

/**
 * Reads one entity as a member, through the permission function. Returns only
 * rendered values and writes an audit event for every read, allowed or not.
 */
export async function readEntity(
  db: Db,
  readerId: string,
  externalRef: string,
  opts: ReadOptions = {},
  ctx?: PermissionContext,
): Promise<EntityView> {
  ctx ??= await loadPermissionContext(db, ENTITY_TYPE);
  const raw = await loadRaw(db, ctx, externalRef);
  const visible =
    raw && canSeeEntity(ctx, readerId, raw.ref) && (!opts.onBehalfOf || canSeeEntity(ctx, opts.onBehalfOf, raw.ref));
  if (!raw || !visible) {
    await audit(db, { actor: readerId, onBehalfOf: opts.onBehalfOf, action: "read_denied", target: externalRef });
    // Same error whether it doesn't exist or isn't yours, so nothing leaks.
    throw new PermissionError(`Nothing found for ${externalRef}`);
  }

  const fields: Record<string, FieldView> = {};
  const levels: Record<string, Level> = {};
  for (const f of ctx.fields.values()) {
    if (opts.keys && !opts.keys.includes(f.key)) continue;
    const level = visibleLevel(ctx, readerId, raw.ref, f, { onBehalfOf: opts.onBehalfOf });
    levels[f.key] = level;
    fields[f.key] = {
      key: f.key,
      label: f.label,
      type: f.type,
      owner_unit_id: f.owner_unit_id,
      markings: level === "none" ? [] : markingsFor(ctx, raw.ref, f).map((m) => m.label),
      ...renderField(f.type, raw.values.get(f.id), level),
    };
  }
  await audit(db, {
    actor: readerId,
    onBehalfOf: opts.onBehalfOf,
    action: "read",
    target: externalRef,
    detail: { revision: raw.revision, levels },
  });
  return { external_ref: externalRef, revision: raw.revision, fields };
}

export interface WriteOptions {
  /** An agent's write needs a person in its unit to approve it. */
  approvedBy?: string;
}

/** Writes one field. Only members of the owning unit may write it. */
export async function writeField(
  db: Db,
  writerId: string,
  externalRef: string,
  key: string,
  value: unknown,
  opts: WriteOptions = {},
): Promise<void> {
  const ctx = await loadPermissionContext(db, ENTITY_TYPE);
  const field = ctx.fieldsByKey.get(key);
  const writer = ctx.members.get(writerId);
  const fail = async (reason: string) => {
    await audit(db, { actor: writerId, action: "write_denied", target: externalRef, detail: { field: key, reason } });
    throw new PermissionError(reason);
  };
  if (!field || !writer) return fail(`Unknown field or member`);
  if (!canWrite(ctx, writerId, field)) return fail(`${writer.name} can't write ${field.label}`);
  if (writer.kind === "agent") {
    const approver = opts.approvedBy ? ctx.members.get(opts.approvedBy) : undefined;
    if (!approver || approver.kind !== "person" || approver.unit_id !== writer.unit_id) {
      return fail(`${writer.name} needs approval from a member of its unit`);
    }
  }
  const e = await db.query<{ id: string }>("update entity set revision = revision + 1 where external_ref = $1 returning id", [
    externalRef,
  ]);
  if (!e.rows[0]) return fail(`Nothing found for ${externalRef}`);
  await db.query(
    `insert into field_value (entity_id, field_id, value_json, updated_by, updated_at) values ($1, $2, $3, $4, now())
     on conflict (entity_id, field_id) do update set value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = now()`,
    [e.rows[0].id, field.id, JSON.stringify(value), writerId],
  );
  await audit(db, {
    actor: writerId,
    action: "write",
    target: externalRef,
    detail: { field: key, ...(opts.approvedBy ? { approved_by: opts.approvedBy } : {}) },
  });
  const raw = await loadRaw(db, ctx, externalRef);
  if (raw) await shareOnTrigger(db, ctx, raw, field, "on_change", writerId);
}
