import type { Db } from "./db";
import { ENTITY_TYPE, type RawEntity, audit, loadAllRaw } from "./entities";
import { rank } from "./levels";
import { type Member, type PermissionContext, canSeeEntity, loadPermissionContext, visibleLevel } from "./permissions";
import { type Status, renderField } from "./render";
import { DEMO_TODAY } from "./seed";

/**
 * Read models for the screens. Aggregates are computed on the server from raw
 * values, but a value only counts when the reader may see that field at least
 * at Status only, so a count never reveals more than the reader could read.
 */

export const STATUS_KEYS = ["engineering_status", "compliance_status", "supply_status", "marketing_status", "sales_status"];
export const TARGET_DAYS = 30;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export interface Row {
  ref: string;
  name: string;
  holder: string | null;
  days_open: number | null;
  target_date: string | null;
  statuses: { key: string; unit: string; state: Status["state"] | "locked"; text: string | null }[];
  waiting: { waiter: string; waiter_id: string; on: string; on_id: string; since?: string; days_left: number | null }[];
  partner: string | null;
}

export interface Overview {
  ctx: PermissionContext;
  reader: Member;
  rows: Row[];
  metrics: { open: number; median_days: number | null; past_target: number; rounds: number | null; blocked: number; holders: [string, number][]; blocked_by: [string, number][] };
}

function val<T>(ctx: PermissionContext, raw: RawEntity, key: string): T | undefined {
  const f = ctx.fieldsByKey.get(key);
  return f ? (raw.values.get(f.id) as T | undefined) : undefined;
}

export async function overview(db: Db, readerId: string): Promise<Overview> {
  const ctx = await loadPermissionContext(db, ENTITY_TYPE);
  const reader = ctx.members.get(readerId)!;
  const all = (await loadAllRaw(db, ctx)).filter((r) => canSeeEntity(ctx, readerId, r.ref));
  const lvl = (raw: RawEntity, key: string) => {
    const f = ctx.fieldsByKey.get(key);
    return f ? visibleLevel(ctx, readerId, raw.ref, f) : "none";
  };
  const atLeastStatus = (raw: RawEntity, key: string) => rank(lvl(raw, key)) >= rank("status");

  const rows: Row[] = all.map((raw) => {
    const started = atLeastStatus(raw, "started_at") ? val<string>(ctx, raw, "started_at") : undefined;
    const statuses = STATUS_KEYS.map((key) => {
      const f = ctx.fieldsByKey.get(key)!;
      const level = lvl(raw, key);
      const v = val<Status>(ctx, raw, key);
      const r = renderField(f.type, v, level);
      return {
        key,
        unit: ctx.units.get(f.owner_unit_id)!.name,
        state: (level === "none" ? "locked" : (v?.state ?? "not_started")) as Row["statuses"][number]["state"],
        text: r.text,
      };
    });
    const waiting = STATUS_KEYS.flatMap((key) => {
      const v = val<Status>(ctx, raw, key);
      if (v?.state !== "waiting" || !v.waiting_on || !atLeastStatus(raw, key)) return [];
      // When will it land? From the holding team's own clock, if the reader can see it.
      const onKey = STATUS_KEYS.find((k) => ctx.fieldsByKey.get(k)?.owner_unit_id === v.waiting_on);
      const on = onKey && atLeastStatus(raw, onKey) ? val<Status>(ctx, raw, onKey) : undefined;
      const days_left = on?.day && on.of ? Math.max(0, on.of - on.day) : null;
      return [{ waiter: v.unit, waiter_id: ctx.fieldsByKey.get(key)!.owner_unit_id, on: v.waiting_on_name ?? v.waiting_on, on_id: v.waiting_on, since: v.since, days_left }];
    });
    const partner = val<{ name: string }>(ctx, raw, "partner");
    return {
      ref: raw.external_ref,
      name: renderField("text", val(ctx, raw, "name"), lvl(raw, "name")).text ?? raw.external_ref,
      holder: atLeastStatus(raw, "holder") ? (val<string>(ctx, raw, "holder") ?? null) : null,
      days_open: started ? daysBetween(started, DEMO_TODAY) : null,
      target_date: atLeastStatus(raw, "target_date") ? (val<string>(ctx, raw, "target_date") ?? null) : null,
      statuses,
      waiting,
      partner: partner && rank(lvl(raw, "partner")) >= rank("summary") ? partner.name : null,
    };
  });

  const days = rows.map((r) => r.days_open).filter((d): d is number => d !== null).sort((a, b) => a - b);
  const median = days.length ? (days[Math.floor((days.length - 1) / 2)] + days[Math.ceil((days.length - 1) / 2)]) / 2 : null;
  const roundsVals = all
    .filter((r) => atLeastStatus(r, "handoff_rounds"))
    .map((r) => Number(val(ctx, r, "handoff_rounds")))
    .filter((n) => !Number.isNaN(n));
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  await audit(db, { actor: readerId, action: "read_aggregate", target: ENTITY_TYPE, detail: { entities: rows.length } });
  return {
    ctx,
    reader,
    rows,
    metrics: {
      open: rows.length,
      median_days: median,
      past_target: days.filter((d) => d > TARGET_DAYS).length,
      rounds: roundsVals.length ? roundsVals.reduce((a, b) => a + b, 0) / roundsVals.length : null,
      blocked: rows.filter((r) => r.waiting.length > 0).length,
      holders: count(rows.map((r) => r.holder).filter((h): h is string => !!h)),
      blocked_by: count(rows.flatMap((r) => r.waiting.map((w) => w.on))),
    },
  };
}

export interface FeedItem {
  id: number;
  at: string;
  target: string;
  detail: { entity_name: string; field_label: string; from_unit: string; level: string; text: string; markings?: string[]; member?: string };
}

/** A unit's feed: share events addressed to it. Public-unit members see only shares meant for them. */
export async function feedFor(db: Db, reader: Member, unitKind: string, limit = 30): Promise<FeedItem[]> {
  const rows = await db.query<FeedItem>(
    `select id, to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at, target, detail from audit_event
     where action = 'share' and to_unit_id = $1 ${unitKind === "public" ? "and detail->>'member' = $3" : "and $3::text is not null"}
     order by at desc, id desc limit $2`,
    [reader.unit_id, limit, reader.id],
  );
  return rows.rows;
}
