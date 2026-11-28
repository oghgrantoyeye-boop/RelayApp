// Beacon learns each team's picture from what the team says and does (roadmap Phase 1, step 2).
// One entry point, learnFrom(), takes a piece of the team's own activity, extracts lasting claims,
// records each as a signal and merges it into the team's context under the trust rules.
import type { Db } from "./db";
import { now } from "./clock";
import { audit, newId } from "./data";
import { extractContext } from "./ai/tasks";
import { applySignal } from "./context-policy";
import { getAiScope, setAiScope } from "./ai/scope";

export type LearnKind = "answer" | "agent_chat" | "update" | "pr" | "coding_session" | "meeting" | "source_doc" | "slack";

export interface LearnSource {
  /** The team the text belongs to. Beacon only learns about a team from that team's own activity. */
  unitId: string;
  kind: LearnKind;
  /** Stable id of the source (request id, PR number, message id), so the same source never counts twice. */
  ref: string;
  /** Shown to the team next to what was learned, e.g. "Ken Watanabe's answer". */
  label: string;
  text: string;
  question?: string;
  repo?: string;
  at?: Date;
  /** Markings on the source. Anything learned from it inherits them and waits for confirmation. */
  markingIds?: string[];
  /** The source is seen by fewer people than team context is, so everything new from it waits for a teammate. */
  needsTeammate?: boolean;
  /** Who wrote it, for the audit log. */
  actorId?: string;
  /** Offline extractor only (seeding sample workspaces). */
  offline?: boolean;
}

export interface LearnResult {
  signals: number;
  created: string[];
  merged: string[];
  pending: string[];
  by: string;
}

export async function learnFrom(db: Db, src: LearnSource): Promise<LearnResult> {
  const result: LearnResult = { signals: 0, created: [], merged: [], pending: [], by: "" };
  const text = src.text.trim();
  if (!text) return result;
  const unit = await db.one(`select id, name, org_id from unit where id = $1`, [src.unitId]);
  if (!unit) return result;
  // Webhooks and hooks learn outside a signed-in request: count their model calls against the team's workspace.
  if (!getAiScope()?.orgId) setAiScope(db, unit.org_id);
  const known = (await db.query(`select title from context_entry where unit_id = $1 and status <> 'retired' order by last_seen_at desc limit 40`, [src.unitId])).map((r) => r.title as string);
  const { claims, by } = await extractContext({ teamName: unit.name, kind: src.kind, text, question: src.question, repo: src.repo, known, offline: src.offline });
  result.by = by;
  const at = src.at ?? now();
  for (const claim of claims) {
    const id = newId("cs");
    await db.query(
      `insert into context_signal (id, unit_id, source_kind, source_ref, source_label, claim, marking_ids, at) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, src.unitId, src.kind, src.ref, src.label, JSON.stringify(src.needsTeammate ? { ...claim, needs_teammate: true } : claim), src.markingIds ?? [], at],
    );
    const signal = (await db.one(`select * from context_signal where id = $1`, [id]))!;
    const applied = await applySignal(db, signal);
    result.signals++;
    if (applied.outcome === "created") result.created.push(applied.entryId);
    if (applied.outcome === "merged") result.merged.push(applied.entryId);
    if (applied.status === "pending" && applied.outcome !== "ignored") result.pending.push(applied.entryId);
  }
  if (result.signals > 0)
    await audit(db, {
      orgId: unit.org_id,
      actorId: src.actorId ?? null,
      action: "context_learn",
      targetKind: "unit",
      targetId: src.unitId,
      detail: { source: src.kind, ref: src.ref, created: result.created, merged: result.merged, pending: result.pending, by },
    });
  return result;
}

/**
 * Learning is a side effect of the team's work, so it must never block that work: a failure
 * is logged and the answer, message or update still goes through.
 */
export async function learnQuietly(db: Db, src: LearnSource): Promise<LearnResult | null> {
  try {
    return await learnFrom(db, src);
  } catch (err) {
    console.error(`[beacon] learning from ${src.kind} ${src.ref} failed:`, err);
    return null;
  }
}
