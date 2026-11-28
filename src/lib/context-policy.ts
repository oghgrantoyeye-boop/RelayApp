// How a learned claim becomes team context (roadmap Phase 1, step 3). Low-risk claims apply right
// away, tagged as learned. Claims about who owns what, what a team can take on, or that came from a
// marked source wait for one team member to confirm. A team's own edits are never overwritten.
import type { Db, Row } from "./db";
import { now } from "./clock";
import { newId } from "./data";
import { jaccard, overlap, tokens } from "./ai/offline";

export const NEEDS_CONFIRMATION_KINDS = ["responsibility", "capability"] as const;

/** Whether a new claim waits for a team member before other teams see it. */
export function needsConfirmation(kind: string, markingIds: string[]): boolean {
  return (NEEDS_CONFIRMATION_KINDS as readonly string[]).includes(kind) || markingIds.length > 0;
}

/** Two titles name the same fact. */
export function sameFact(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  return jaccard(ta, tb) >= 0.5 || (overlap(ta, tb) >= 3 && jaccard(ta, tb) >= 0.34);
}

export interface SourceRef {
  kind: string;
  ref: string;
  label: string;
  at: string;
}

export type ApplyOutcome = "created" | "merged" | "ignored";

/**
 * Merge one signal into the team's context: strengthen the entry for the same fact, or start a new
 * one. A signal for something the team removed is kept on record but never brings it back.
 */
export async function applySignal(db: Db, signal: Row): Promise<{ entryId: string; outcome: ApplyOutcome; status: string }> {
  // needs_teammate: the source is visible to fewer people than team context is (a meeting, say),
  // so anything new from it waits for a teammate even if its kind wouldn't.
  const claim = signal.claim as { kind: string; title: string; body?: string; needs_teammate?: boolean };
  const source: SourceRef = { kind: signal.source_kind, ref: signal.source_ref, label: signal.source_label, at: new Date(signal.at).toISOString() };
  const markings: string[] = signal.marking_ids ?? [];
  const candidates = await db.query(`select * from context_entry where unit_id = $1 and kind = $2 order by last_seen_at desc`, [signal.unit_id, claim.kind]);
  const match = candidates.find((e) => sameFact(e.title, claim.title));

  if (match) {
    await db.query(`update context_signal set entry_id = $2 where id = $1`, [signal.id, match.id]);
    if (match.status === "retired") return { entryId: match.id, outcome: "ignored", status: "retired" };
    const refs: SourceRef[] = match.source_refs ?? [];
    if (refs.some((r) => r.kind === source.kind && r.ref === source.ref)) return { entryId: match.id, outcome: "ignored", status: match.status };
    const mergedMarkings = [...new Set([...(match.marking_ids ?? []), ...markings])];
    // A newly marked source can make an active entry need confirmation again.
    const status = match.status === "active" && markings.some((m) => !(match.marking_ids ?? []).includes(m)) && match.provenance === "learned" ? "pending" : match.status;
    await db.query(
      `update context_entry set source_refs = $2, confidence = least(0.95, confidence + 0.15), marking_ids = $3, status = $4,
         last_seen_at = greatest(last_seen_at, $5), updated_at = $6,
         body = case when provenance = 'learned' and body = '' and not $8 then $7 else body end
       where id = $1`,
      [match.id, JSON.stringify([...refs, source].slice(-20)), mergedMarkings, status, signal.at, now(), claim.body ?? "", !!claim.needs_teammate],
    );
    return { entryId: match.id, outcome: "merged", status };
  }

  const id = newId("ce");
  const status = claim.needs_teammate || needsConfirmation(claim.kind, markings) ? "pending" : "active";
  await db.query(
    `insert into context_entry (id, unit_id, kind, title, body, provenance, confidence, source_refs, marking_ids, status, first_seen_at, last_seen_at, updated_at)
     values ($1, $2, $3, $4, $5, 'learned', 0.5, $6, $7, $8, $9, $9, $10)`,
    [id, signal.unit_id, claim.kind, claim.title.slice(0, 160), (claim.body ?? "").slice(0, 600), JSON.stringify([source]), markings, status, signal.at, now()],
  );
  await db.query(`update context_signal set entry_id = $2 where id = $1`, [signal.id, id]);
  return { entryId: id, outcome: "created", status };
}
