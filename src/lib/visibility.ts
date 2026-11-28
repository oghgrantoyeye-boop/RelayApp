// T-17: what Beacon can see for a team. One row per source with Live, Sample or Planned, when it
// last synced, and the gaps: kinds of team context Beacon hasn't learned anything about yet.
// Only a connector Beacon really reads (mode 'live', e.g. the GitHub App) shows as Live. A tool
// connected as a preview in a real workspace is Planned, never Live; sample workspaces say Sample.
import type { Db } from "./db";
import { now } from "./clock";
import { CONNECTOR_LABEL } from "./integrations";

export type SeeStatus = "live" | "sample" | "planned";

export interface SeeRow {
  tool: string;
  detail: string;
  status: SeeStatus;
  lastSync: Date | null;
}

export interface WhatBeaconSees {
  rows: SeeRow[];
  gaps: string[];
}

/** Context kinds whose absence is worth telling the team about, in the words the card uses. */
const GAP_KINDS: [string, (team: string) => string][] = [
  ["responsibility", (t) => `what ${t} owns`],
  ["capability", (t) => `what ${t} can take on`],
  ["how_to_work", (t) => `how to work with ${t}`],
];

export function ago(at: Date, from: Date = now()): string {
  const mins = Math.max(0, Math.round((from.getTime() - at.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function whatBeaconSees(db: Db, unitId: string, opts: { isSample: boolean }): Promise<WhatBeaconSees> {
  const unit = (await db.one(`select name from unit where id = $1`, [unitId]))!;
  const connectors = await db.query(`select kind, name, mode, last_sync_at from connector where unit_id = $1 order by kind, name`, [unitId]);
  const rows: SeeRow[] = connectors.map((c) => {
    const tool = CONNECTOR_LABEL[c.kind] ?? c.kind;
    const lastSync = c.last_sync_at ? new Date(c.last_sync_at) : null;
    if (c.mode === "live") return { tool, detail: `${c.name}${lastSync ? ` · synced ${ago(lastSync)}` : " · not synced yet"}`, status: "live", lastSync };
    if (opts.isSample) return { tool, detail: `${c.name} · sample data`, status: "sample", lastSync };
    return { tool, detail: `Not connected yet. Beacon can't read ${tool} for real until it's live.`, status: "planned", lastSync: null };
  });

  // Claude Code: members who have sent at least one coding session.
  const members = await db.query(`select user_id from member where unit_id = $1 and role <> 'agent'`, [unitId]);
  const ids = members.map((m) => m.user_id);
  if (ids.length > 0) {
    const sent = await db.one(
      `select count(distinct actor_id)::int as n, max(at) as last from audit_event where action = 'source_coding_session' and actor_id = any($1)`,
      [ids],
    );
    if (sent && sent.n > 0) {
      const lastSync = sent.last ? new Date(sent.last) : null;
      rows.push({ tool: "Claude Code", detail: `${sent.n} of ${ids.length} members send sessions`, status: "live", lastSync });
    }
  }
  rows.sort((a, b) => order(a.status) - order(b.status));

  const kinds = new Set(
    (await db.query(`select distinct kind from context_entry where unit_id = $1 and status = 'active'`, [unitId])).map((r) => r.kind as string),
  );
  const gaps = GAP_KINDS.filter(([k]) => !kinds.has(k)).map(([, label]) => `Nothing learned yet about ${label(unit.name)}.`);
  if (rows.length === 0) gaps.unshift(`No tools connected, so Beacon only knows what ${unit.name} tells it directly.`);
  return { rows, gaps };
}

const order = (s: SeeStatus) => (s === "live" ? 0 : s === "sample" ? 1 : 2);
