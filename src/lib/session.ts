import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { loadViewer } from "./data";
import { activeDemo } from "./demo";
import { setAiScope } from "./ai/scope";
import { accountFromSession, SESSION_COOKIE } from "./auth/accounts";
import { isSampleOrg } from "./auth/workspaces";

// Sample workspaces still use a persona cookie. Signed-in people use a session cookie and pick a
// workspace; the persona switcher is hidden outside sample orgs.
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
  const account = await accountFromSession(db, jar.get(SESSION_COOKIE)?.value);

  const orgCookie = jar.get(WORKSPACE_COOKIE)?.value;
  let org = orgCookie ? await db.one(`select id, settings from org where id = $1`, [orgCookie]) : null;

  // Signed in + membership for this workspace: use that app_user, not a demo persona.
  if (account && org) {
    const membership = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [account.id, org.id]);
    if (membership) {
      const viewer = await loadViewer(db, membership.user_id, org.id);
      if (viewer) {
        const demo = await activeDemo(db, org.id);
        setAiScope(db, org.id);
        return {
          db,
          viewer,
          demo,
          orgId: org.id as string,
          account,
          isSample: isSampleOrg(org.settings),
        };
      }
    }
  }

  // Sample / demo path: persona cookie inside a demo workspace. A real workspace is never opened
  // this way: without a membership, its cookie is ignored and the default sample loads instead.
  if (org && !isSampleOrg(org.settings)) org = null;
  const orgId = (org?.id as string | undefined) ?? undefined;
  const demo = await activeDemo(db, orgId);
  const activeOrg = orgId ?? demo.id;
  const orgRow = await db.one(`select settings from org where id = $1`, [activeOrg]);
  const { scopedPersona } = await import("./scoped");
  const defaultPersona =
    (orgRow?.settings?.default_persona as string | undefined) || scopedPersona(activeOrg, demo.defaultPersona);
  const id = jar.get(PERSONA_COOKIE)?.value ?? defaultPersona;
  let viewer = await loadViewer(db, id, activeOrg);
  if (!viewer || viewer.user.kind !== "human") viewer = await loadViewer(db, defaultPersona, activeOrg);
  if (!viewer) {
    const any = await db.one(`select id from app_user where org_id = $1 and kind = 'human' order by name limit 1`, [activeOrg]);
    viewer = any ? await loadViewer(db, any.id, activeOrg) : null;
  }
  // Model calls in this request count against this workspace's AI budget (T-35).
  setAiScope(db, activeOrg);
  return {
    db,
    viewer: viewer!,
    demo,
    orgId: activeOrg,
    account,
    // Only sample workspaces reach this path, including a fresh database before any seed.
    isSample: true,
  };
}
