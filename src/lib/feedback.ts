// Answer feedback (T-21). The person who asked says whether the agent's answer helped. A thumbs down
// lowers Beacon's confidence in the learned context the answer used, so weak entries stop leading
// answers and show up for the team to fix; a thumbs up nudges it back. Every vote is audited.
import type { Db, Row } from "./db";
import { now } from "./clock";
import { audit, newId, type Viewer } from "./data";
import { PermissionError } from "./permissions";

export type Vote = "up" | "down";

/** How much one vote moves an entry's confidence, and the floor and ceiling. */
export const DOWN_STEP = 0.2;
export const UP_STEP = 0.05;
const FLOOR = 0.1;
const CEILING = 0.95;

function contextIds(q: Row): string[] {
  const refs: string[] = q.source_refs ?? [];
  return refs.filter((r) => r.startsWith("context:")).map((r) => r.slice("context:".length));
}

export async function rateAnswer(db: Db, viewer: Viewer, questionId: string, vote: Vote, note = "") {
  const q = await db.one(`select * from question where id = $1 and org_id = $2`, [questionId, viewer.orgId]);
  if (!q) throw new Error("That answer doesn't exist.");
  if (q.asker_id !== viewer.user.id) throw new PermissionError("Only the person who asked can rate the answer.");
  const previous = await db.one(`select vote from answer_feedback where question_id = $1 and user_id = $2`, [questionId, viewer.user.id]);
  const text = note.trim().slice(0, 600);
  await db.query(
    `insert into answer_feedback (id, org_id, question_id, user_id, vote, note, at) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (question_id, user_id) do update set vote = excluded.vote, note = excluded.note, at = excluded.at`,
    [newId("fb"), viewer.orgId, questionId, viewer.user.id, vote, text, now()],
  );
  // Only a change of vote moves confidence, so voting twice doesn't count twice.
  const ids = contextIds(q);
  if (previous?.vote !== vote && ids.length > 0) {
    const undo = previous ? (previous.vote === "down" ? DOWN_STEP : -UP_STEP) : 0;
    const delta = (vote === "down" ? -DOWN_STEP : UP_STEP) + undo;
    await db.query(
      `update context_entry set confidence = least($3::numeric, greatest($4::numeric, confidence + $2::numeric)), updated_at = $5
        where id = any($1) and provenance = 'learned'`,
      [ids, delta, CEILING, FLOOR, now()],
    );
  }
  await audit(db, {
    orgId: viewer.orgId, actorId: viewer.user.id, action: "answer_feedback", targetKind: "question", targetId: questionId,
    detail: { vote, note: text || null, context: ids },
  });
}

export async function myVote(db: Db, viewer: Viewer, questionId: string): Promise<{ vote: Vote; note: string } | null> {
  const r = await db.one(`select vote, note from answer_feedback where question_id = $1 and user_id = $2`, [questionId, viewer.user.id]);
  return r ? { vote: r.vote, note: r.note } : null;
}
