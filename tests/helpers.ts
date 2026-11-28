import { DEFAULT_DEMO } from "@/lib/demos";
import { scoped } from "@/lib/scoped";

/** Scope a pack-local id to the default demo org used by most tests. */
export const sid = (local: string, orgId = DEFAULT_DEMO) => scoped(orgId, local);

/**
 * Seeding learns each team's context from the sample history (T-14). Tests of the learning rules
 * themselves start from a blank slate so they see exactly what one source does.
 */
export async function clearLearned(db: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await db.query(`delete from context_signal`);
  await db.query(`delete from context_entry`);
}
