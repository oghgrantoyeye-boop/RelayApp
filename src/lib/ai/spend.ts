// AI spend per workspace (T-35). Every model call is recorded in ai_usage with its tokens and cost.
// When a workspace has a monthly cap (org.settings.ai_monthly_usd) and this month's spend reaches it,
// the model adapter stops calling the model for that workspace and the offline writer answers instead.
import type { Db } from "../db";
import { now } from "../clock";
import { PRICE_PER_MTOK } from "./llm";

export function costUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000;
}

function monthStart(d: Date = now()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** The first day of next month, when a reached cap resets. */
export function capResetsAt(d: Date = now()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export async function recordUsage(db: Db, input: { orgId: string | null; task: string; inputTokens: number; outputTokens: number }) {
  await db.query(
    `insert into ai_usage (org_id, task, input_tokens, output_tokens, cost_usd, at) values ($1, $2, $3, $4, $5, $6)`,
    [input.orgId, input.task, input.inputTokens, input.outputTokens, costUsd(input.inputTokens, input.outputTokens), now()],
  );
}

export interface MonthSpend {
  usd: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** The workspace's monthly cap in dollars, or null for no cap. */
  cap: number | null;
  capped: boolean;
}

export async function monthSpend(db: Db, orgId: string): Promise<MonthSpend> {
  const row = await db.one(
    `select coalesce(sum(cost_usd), 0)::float as usd, count(*)::int as calls, coalesce(sum(input_tokens), 0)::int as input, coalesce(sum(output_tokens), 0)::int as output
       from ai_usage where org_id = $1 and at >= $2`,
    [orgId, monthStart()],
  );
  const org = await db.one(`select settings from org where id = $1`, [orgId]);
  const raw = Number(org?.settings?.ai_monthly_usd);
  const cap = Number.isFinite(raw) && raw > 0 ? raw : null;
  const usd = Number(row?.usd ?? 0);
  return { usd, calls: row?.calls ?? 0, inputTokens: row?.input ?? 0, outputTokens: row?.output ?? 0, cap, capped: cap !== null && usd >= cap };
}

/** Set or clear a workspace's monthly cap. Null or 0 means no cap. */
export async function setMonthlyCap(db: Db, orgId: string, usd: number | null) {
  const value = usd && usd > 0 ? Math.round(usd * 100) / 100 : null;
  await db.query(
    `update org set settings = case when $2::numeric is null then settings - 'ai_monthly_usd' else jsonb_set(settings, '{ai_monthly_usd}', to_jsonb($2::numeric)) end where id = $1`,
    [orgId, value],
  );
  return value;
}

/**
 * Only a signed-in owner or admin of a real workspace sets its budget. Sample workspaces are shared
 * by every visitor, so nobody there can change it.
 */
export async function canSetBudget(db: Db, accountId: string | null | undefined, orgId: string, isSample: boolean): Promise<boolean> {
  if (isSample || !accountId) return false;
  const m = await db.one(`select role from org_membership where account_id = $1 and org_id = $2`, [accountId, orgId]);
  return m?.role === "owner" || m?.role === "admin";
}
