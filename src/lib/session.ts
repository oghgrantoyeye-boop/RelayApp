import { cookies } from "next/headers";
import { appDb } from "./app-db";
import type { Member } from "./permissions";

export const PERSONA_COOKIE = "relay_as";
export const DEFAULT_PERSONA = "maya";

/** v0 has no login: a persona switcher picks who you are, and the server enforces everything as that member. */
export async function currentPersona(): Promise<Member> {
  const id = (await cookies()).get(PERSONA_COOKIE)?.value ?? DEFAULT_PERSONA;
  const db = await appDb();
  const r = await db.query<Member>("select id, unit_id, kind, name, role, manager_id from member where id = $1 and kind = 'person'", [id]);
  if (r.rows[0]) return r.rows[0];
  return (await db.query<Member>("select id, unit_id, kind, name, role, manager_id from member where id = $1", [DEFAULT_PERSONA])).rows[0];
}
