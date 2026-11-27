import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { loadViewer } from "./data";
import { activeDemo } from "./demo";

// v1 demo: no login. Visitors pick a seeded person, and the server enforces every permission as
// that person. Swap this for real sign-in (Google, Microsoft) when a pilot starts.
export const PERSONA_COOKIE = "relay_user";

export async function currentViewer() {
  const db = await getDb();
  const demo = await activeDemo(db);
  const id = (await cookies()).get(PERSONA_COOKIE)?.value ?? demo.defaultPersona;
  let viewer = await loadViewer(db, id);
  // After switching demos the cookie can name someone from another organization.
  if (!viewer || viewer.user.kind !== "human") viewer = await loadViewer(db, demo.defaultPersona);
  return { db, viewer: viewer!, demo };
}
