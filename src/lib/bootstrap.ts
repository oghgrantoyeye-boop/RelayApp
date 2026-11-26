import { type Db, migrate } from "./db";
import { ENTITY_TYPE, loadAllRaw, shareOnTrigger } from "./entities";
import { loadPermissionContext } from "./permissions";
import { DEMO_REF, DEMO_TODAY, seed } from "./seed";

/** Migrate, seed the demo pack, and backfill team feeds so the demo opens with history. Idempotent. */
export async function setup(db: Db): Promise<void> {
  await migrate(db);
  await seed(db);
  const shares = await db.query<{ n: number }>("select count(*)::int as n from audit_event where action = 'share'");
  if (shares.rows[0].n > 0) return;

  const ctx = await loadPermissionContext(db, ENTITY_TYPE);
  const all = await loadAllRaw(db, ctx);
  const named = new Set(["LK-009", "LK-011", "LK-016", "LK-012", "LK-007", "LK-015", "LK-010"]);
  for (const raw of all) {
    const values = [...raw.values.entries()];
    const hasWaiting = values.some(([, v]) => (v as { state?: string })?.state === "waiting");
    if (raw.external_ref !== DEMO_REF && !named.has(raw.external_ref) && !hasWaiting) continue;
    for (const [fieldId, v] of values) {
      const field = ctx.fields.get(fieldId)!;
      // History is about work changing hands, not the initiative's basics.
      if (!["status", "checklist", "decision"].includes(field.type)) continue;
      const since = (v as { since?: string })?.since;
      const at = `${since ?? DEMO_TODAY}T${String(8 + (fieldId.length % 9)).padStart(2, "0")}:${String((fieldId.length * 7) % 60).padStart(2, "0")}:00Z`;
      await shareOnTrigger(db, ctx, raw, field, "on_change", null, at);
      if (field.key === "approved_claims") await shareOnTrigger(db, ctx, raw, field, "on_approval", null, "2027-01-13T15:00:00Z");
    }
  }
}
