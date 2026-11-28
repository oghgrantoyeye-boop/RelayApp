import type { Db } from "./db";

/**
 * Remove one workspace and everything in it. Leaves other orgs, accounts and sessions alone.
 * Order follows foreign keys that don't cascade from org.
 */
export async function deleteWorkspace(db: Db, orgId: string) {
  await db.tx(async (t) => {
    const q = (sql: string, params: unknown[] = []) => t.query(sql, params);
    // Auth links into this org (accounts themselves stay).
    await q(`delete from org_membership where org_id = $1`, [orgId]);
    // Leaf activity
    await q(`delete from delivery where org_id = $1`, [orgId]);
    await q(`delete from audit_event where org_id = $1`, [orgId]);
    await q(`delete from chat_message where org_id = $1`, [orgId]);
    await q(`delete from context_signal where org_id = $1`, [orgId]);
    await q(`delete from context_entry where org_id = $1`, [orgId]);
    await q(`delete from task_run where org_id = $1`, [orgId]);
    await q(`delete from meeting where org_id = $1`, [orgId]);
    await q(`delete from source_doc where org_id = $1`, [orgId]);
    await q(`delete from connector where org_id = $1`, [orgId]);
    await q(`delete from question where org_id = $1`, [orgId]);
    await q(`delete from request where org_id = $1`, [orgId]);
    await q(`delete from commitment where org_id = $1`, [orgId]);
    await q(`delete from update_item where org_id = $1`, [orgId]);
    await q(`delete from team_update where org_id = $1`, [orgId]);
    await q(`delete from follow where org_id = $1`, [orgId]);
    await q(`delete from interface where org_id = $1`, [orgId]);
    await q(`delete from ownership_item where org_id = $1`, [orgId]);
    await q(`delete from agent_profile where org_id = $1`, [orgId]);
    await q(`delete from member where org_id = $1`, [orgId]);
    await q(`delete from marking where org_id = $1`, [orgId]);
    await q(`delete from app_user where org_id = $1`, [orgId]);
    await q(`delete from unit where org_id = $1`, [orgId]);
    await q(`delete from org where id = $1`, [orgId]);
  });
}

/** Wipe one sample workspace and seed it again. */
export async function resetWorkspace(db: Db, demoId: string) {
  const { getDemo } = await import("./demos");
  const { seed } = await import("./seed");
  const pack = getDemo(demoId);
  const exists = await db.one(`select id from org where id = $1`, [pack.id]);
  if (exists) await deleteWorkspace(db, pack.id);
  await seed(db, pack.id);
}
