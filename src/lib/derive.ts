import type { Db } from "./db";
import { type EntityView, readEntity } from "./entities";
import type { Llm } from "./llm";

/** A derived output (summary, digest, agent answer). It carries every marking of its inputs. */
export interface Derived {
  text: string;
  markings: string[];
  sources: string[]; // unit ids the facts came from
}

/**
 * Summarizes an entity for one reader. The input is only what that reader can
 * see, at their level: it is never built from full data and filtered after.
 */
export async function summarizeFor(
  db: Db,
  llm: Llm,
  readerId: string,
  externalRef: string,
  opts: { audience: string; keys?: string[]; onBehalfOf?: string | null },
): Promise<Derived> {
  const view: EntityView = await readEntity(db, readerId, externalRef, { keys: opts.keys, onBehalfOf: opts.onBehalfOf });
  const used = Object.values(view.fields).filter((f) => !f.locked && f.text);
  const units = new Map(
    (await db.query<{ id: string; name: string }>("select id, name from unit")).rows.map((u) => [u.id, u.name]),
  );
  const text = await llm.summarize({
    audience: opts.audience,
    facts: used.map((f) => ({ label: f.label, text: f.text!, source_unit: units.get(f.owner_unit_id) ?? f.owner_unit_id })),
  });
  return {
    text,
    markings: [...new Set(used.flatMap((f) => f.markings))].sort(),
    sources: [...new Set(used.map((f) => f.owner_unit_id))].sort(),
  };
}
