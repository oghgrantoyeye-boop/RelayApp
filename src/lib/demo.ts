// Which demo organization is loaded. The seeder stores its id in org.settings.demo.
import type { Db } from "./db";
import { ORG_ID } from "./data";
import { getDemo, type DemoPack } from "./demos";
import { workersEnabled } from "./flags";

/** Guide steps that open a page hidden while work-performing agents are off. */
const DEFERRED = [/^\/digest/, /^\/map/, /^\/agents\/new/, /\/tasks\//];

export async function activeDemo(db: Db): Promise<DemoPack> {
  const org = await db.one(`select settings from org where id = $1`, [ORG_ID]);
  const pack = getDemo(org?.settings?.demo);
  if (workersEnabled()) return pack;
  const shown = (s: { href: string }) => !DEFERRED.some((r) => r.test(s.href));
  return { ...pack, guide: pack.guide.filter(shown), explore: pack.explore.filter(shown) };
}
