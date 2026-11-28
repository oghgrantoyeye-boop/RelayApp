"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, destroySession, accountFromSession } from "@/lib/auth/accounts";
import { PERSONA_COOKIE, WORKSPACE_COOKIE, GUIDE_COOKIE } from "@/lib/session";
import { requestMagicLink } from "@/lib/auth/magic";
import { getDemo } from "@/lib/demos";
import { seed } from "@/lib/seed";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function requestEmailSignIn(form: FormData) {
  const email = str(form, "email");
  const db = await getDb();
  let result: { ok: true; devLink?: string };
  try {
    result = await requestMagicLink(db, email);
  } catch (e) {
    redirect(`/signin?error=${encodeURIComponent((e as Error).message)}`);
  }
  const q = new URLSearchParams({ sent: email });
  if (result.devLink) q.set("dev", result.devLink);
  redirect(`/signin?${q.toString()}`);
}

export async function signOut() {
  const jar = await cookies();
  const db = await getDb();
  await destroySession(db, jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
  jar.delete(PERSONA_COOKIE);
  jar.delete(GUIDE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/signin");
}

/** Open a sample workspace (demo pack). Persona switcher stays available there. */
export async function openSampleWorkspace(form: FormData) {
  const demoId = str(form, "demo");
  const pack = getDemo(demoId);
  const db = await getDb();
  const exists = await db.one(`select id from org where id = $1`, [pack.id]);
  if (!exists) await seed(db, pack.id);
  const { scopedPersona } = await import("@/lib/scoped");
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, pack.id, { path: "/", sameSite: "lax", httpOnly: true });
  jar.set(PERSONA_COOKIE, scopedPersona(pack.id, pack.defaultPersona), { path: "/", sameSite: "lax", httpOnly: true });
  jar.delete(GUIDE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/guide");
}

/** Enter a workspace the signed-in account belongs to. */
export async function openMemberWorkspace(form: FormData) {
  const orgId = str(form, "orgId");
  const db = await getDb();
  const jar = await cookies();
  const account = await accountFromSession(db, jar.get(SESSION_COOKIE)?.value);
  if (!account) redirect("/signin");
  const membership = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [account.id, orgId]);
  if (!membership) redirect("/signin?error=No%20access%20to%20that%20workspace");
  jar.set(WORKSPACE_COOKIE, orgId, { path: "/", sameSite: "lax", httpOnly: true });
  jar.set(PERSONA_COOKIE, membership.user_id, { path: "/", sameSite: "lax", httpOnly: true });
  jar.delete(GUIDE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/feed");
}
