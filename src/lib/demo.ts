// Which demo organization is loaded. The seeder stores its id on org.id and in org.settings.demo.
import type { Db } from "./db";
import { getDemo, type DemoPack } from "./demos";
import { workersEnabled } from "./flags";

/** Guide steps that open a page hidden while work-performing agents are off. */
const DEFERRED = [/^\/digest/, /^\/map/, /^\/agents\/new/, /\/tasks\//];

export async function activeDemo(db: Db, orgId?: string): Promise<DemoPack> {
  const org = orgId
    ? await db.one(`select id, settings from org where id = $1`, [orgId])
    : await db.one(`select id, settings from org order by id limit 1`);
  const pack = getDemo(org?.settings?.demo ?? org?.id);
  if (workersEnabled()) return pack;
  const shown = (s: { href: string }) => !DEFERRED.some((r) => r.test(s.href));
  return { ...pack, guide: pack.guide.filter(shown), explore: pack.explore.filter(shown) };
}
