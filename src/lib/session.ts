import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { loadViewer } from "./data";
import { activeDemo } from "./demo";

// v1 demo: no login. Visitors pick a seeded person, and the server enforces every permission as
// that person. Swap this for real sign-in (Google, Microsoft) when a pilot starts.
export const PERSONA_COOKIE = "relay_user";
/** The demo guide step someone is on, set by the guide's buttons. */
export const GUIDE_COOKIE = "relay_guide_step";
/** Which agent the panel on every page is talking to: "me" (your own agent) or an agent's id. */
export const DOCK_COOKIE = "relay_dock_target";
/** "closed" when someone hid the agent panel. */
export const DOCK_OPEN_COOKIE = "relay_dock";

export async function currentViewer() {
  const db = await getDb();
  const demo = await activeDemo(db);
  const id = (await cookies()).get(PERSONA_COOKIE)?.value ?? demo.defaultPersona;
  let viewer = await loadViewer(db, id);
  // After switching demos the cookie can name someone from another organization.
  if (!viewer || viewer.user.kind !== "human") viewer = await loadViewer(db, demo.defaultPersona);
  return { db, viewer: viewer!, demo };
}
