// Which demo organization is loaded. The seeder stores its id in org.settings.demo.
import type { Db } from "./db";
import { ORG_ID } from "./data";
import { getDemo, type DemoPack } from "./demos";

export async function activeDemo(db: Db): Promise<DemoPack> {
  const org = await db.one(`select settings from org where id = $1`, [ORG_ID]);
  return getDemo(org?.settings?.demo);
}
