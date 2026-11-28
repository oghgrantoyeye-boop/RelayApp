import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { loadViewer } from "./data";
import { activeDemo } from "./demo";

// v1 demo: no login. Visitors pick a seeded person, and the server enforces every permission as
// that person. Swap this for real sign-in (Google, Microsoft) when a pilot starts.
export const PERSONA_COOKIE = "relay_user";
/** Active workspace id once several workspaces can sit side by side. */
export const WORKSPACE_COOKIE = "relay_org";
/** The demo guide step someone is on, set by the guide's buttons. */
export const GUIDE_COOKIE = "relay_guide_step";
/** Which agent the panel on every page is talking to: "me" (your own agent) or an agent's id. */
export const DOCK_COOKIE = "relay_dock_target";
/** "closed" when someone hid the agent panel. */
export const DOCK_OPEN_COOKIE = "relay_dock";

export async function currentViewer() {
  const db = await getDb();
  const jar = await cookies();
  const orgCookie = jar.get(WORKSPACE_COOKIE)?.value;
  const org = orgCookie ? await db.one(`select id from org where id = $1`, [orgCookie]) : null;
  const orgId = org?.id as string | undefined;
  const demo = await activeDemo(db, orgId);
  const activeOrg = orgId ?? demo.id;
  const id = jar.get(PERSONA_COOKIE)?.value ?? demo.defaultPersona;
  let viewer = await loadViewer(db, id, activeOrg);
  // After switching demos the cookie can name someone from another organization.
  if (!viewer || viewer.user.kind !== "human") viewer = await loadViewer(db, demo.defaultPersona, activeOrg);
  if (!viewer) {
    // Last resort: any human in this workspace.
    const any = await db.one(`select id from app_user where org_id = $1 and kind = 'human' order by name limit 1`, [activeOrg]);
    viewer = any ? await loadViewer(db, any.id, activeOrg) : null;
  }
  return { db, viewer: viewer!, demo, orgId: activeOrg };
}
