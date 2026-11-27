import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { loadViewer } from "./data";

// v1 demo: no login. Visitors pick a seeded person, and the server enforces every permission as
// that person. Swap this for real sign-in (Google, Microsoft) when a pilot starts.
export const PERSONA_COOKIE = "relay_user";
export const DEFAULT_PERSONA = "jordan";

export async function currentViewer() {
  const db = await getDb();
  const id = (await cookies()).get(PERSONA_COOKIE)?.value ?? DEFAULT_PERSONA;
  let viewer = await loadViewer(db, id);
  if (!viewer || viewer.user.kind !== "human") viewer = await loadViewer(db, DEFAULT_PERSONA);
  return { db, viewer: viewer! };
}
