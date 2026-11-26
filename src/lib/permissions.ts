import type { Db } from "./db";
import { type Level, lessDetailed, moreDetailed } from "./levels";

/**
 * The single permission check. Every API route, digest and agent tool call
 * decides what a reader sees through visibleLevel().
 */

export interface Unit {
  id: string;
  name: string;
  kind: "internal" | "public";
}
export interface Member {
  id: string;
  unit_id: string;
  kind: "person" | "agent";
  name: string;
  role: string;
  manager_id: string | null;
}
export interface Field {
  id: string;
  key: string;
  label: string;
  type: string;
  owner_unit_id: string;
}
export interface Interface {
  id: string;
  from_unit_id: string;
  to_unit_id: string;
  field_id: string;
  level: Exclude<Level, "none">;
  status: string;
}
export interface Marking {
  id: string;
  target_kind: "field" | "entity";
  target_id: string;
  label: string;
  rule: { allowed_units?: string[]; max_level_others?: Level };
}
/** What the check needs to know about an entity. */
export interface EntityRef {
  id: string;
  /** The public-unit member this entity belongs to, if any (e.g. a retail partner). */
  external_owner_id: string | null;
}

/** Everything the check reads, loaded once per request. */
export interface PermissionContext {
  units: Map<string, Unit>;
  members: Map<string, Member>;
  fields: Map<string, Field>;
  fieldsByKey: Map<string, Field>;
  /** Active interfaces only, keyed by `${field_id}:${to_unit_id}`. */
  interfaces: Map<string, Interface[]>;
  markings: Marking[];
}

export async function loadPermissionContext(db: Db, entityTypeId: string): Promise<PermissionContext> {
  const [units, members, fields, interfaces, markings] = await Promise.all([
    db.query<Unit>("select id, name, kind from unit"),
    db.query<Member>("select id, unit_id, kind, name, role, manager_id from member"),
    db.query<Field>("select id, key, label, type, owner_unit_id from field where entity_type_id = $1", [entityTypeId]),
    db.query<Interface>(
      "select id, from_unit_id, to_unit_id, field_id, level, status from interface where status = 'active'",
    ),
    db.query<Marking>("select id, target_kind, target_id, label, rule from marking"),
  ]);
  const byField = new Map<string, Interface[]>();
  for (const i of interfaces.rows) {
    const k = `${i.field_id}:${i.to_unit_id}`;
    byField.set(k, [...(byField.get(k) ?? []), i]);
  }
  return {
    units: new Map(units.rows.map((u) => [u.id, u])),
    members: new Map(members.rows.map((m) => [m.id, m])),
    fields: new Map(fields.rows.map((f) => [f.id, f])),
    fieldsByKey: new Map(fields.rows.map((f) => [f.key, f])),
    interfaces: byField,
    markings: markings.rows,
  };
}

/** Markings that apply to this field on this entity. */
export function markingsFor(ctx: PermissionContext, entity: EntityRef, field: Field): Marking[] {
  return ctx.markings.filter(
    (m) =>
      (m.target_kind === "field" && m.target_id === field.id) ||
      (m.target_kind === "entity" && m.target_id === entity.id),
  );
}

/** Can this reader see that the entity exists at all? */
export function canSeeEntity(ctx: PermissionContext, readerId: string, entity: EntityRef): boolean {
  const reader = ctx.members.get(readerId);
  if (!reader) return false;
  const unit = ctx.units.get(reader.unit_id);
  if (unit?.kind === "public") return entity.external_owner_id === reader.id;
  return true;
}

function levelForMember(ctx: PermissionContext, reader: Member, entity: EntityRef, field: Field): Level {
  // 1. The owning unit gets full detail.
  if (reader.unit_id === field.owner_unit_id) return "full";

  // 2. The public unit sees only entities that belong to it.
  if (!canSeeEntity(ctx, reader.id, entity)) return "none";

  // 3. Otherwise, the most detailed level any active interface grants.
  let level: Level = "none";
  for (const i of ctx.interfaces.get(`${field.id}:${reader.unit_id}`) ?? []) {
    if (i.from_unit_id === field.owner_unit_id) level = moreDetailed(level, i.level);
  }

  // 4. Markings cap the result for every unit outside their allowed list.
  for (const m of markingsFor(ctx, entity, field)) {
    if (!(m.rule.allowed_units ?? []).includes(reader.unit_id)) {
      level = lessDetailed(level, m.rule.max_level_others ?? "none");
    }
  }
  return level;
}

/**
 * visible_level(reader, entity, field). With onBehalfOf, an agent sees the
 * lower of its own level and that person's, so it can never read on someone's
 * behalf what they can't read themselves.
 */
export function visibleLevel(
  ctx: PermissionContext,
  readerId: string,
  entity: EntityRef,
  field: Field,
  opts: { onBehalfOf?: string | null } = {},
): Level {
  const reader = ctx.members.get(readerId);
  if (!reader) return "none";
  let level = levelForMember(ctx, reader, entity, field);
  if (opts.onBehalfOf) {
    const person = ctx.members.get(opts.onBehalfOf);
    level = person ? lessDetailed(level, levelForMember(ctx, person, entity, field)) : "none";
  }
  return level;
}

/** Only members of the owning unit can write a field. */
export function canWrite(ctx: PermissionContext, writerId: string, field: Field): boolean {
  return ctx.members.get(writerId)?.unit_id === field.owner_unit_id;
}
