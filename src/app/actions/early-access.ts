"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { accountFromSession, SESSION_COOKIE } from "@/lib/auth/accounts";
import { isAdminEmail, setLeadStatus } from "@/lib/auth/early-access";

async function requireAdmin() {
  const db = await getDb();
  const jar = await cookies();
  const account = await accountFromSession(db, jar.get(SESSION_COOKIE)?.value);
  if (!account || !isAdminEmail(account.email)) notFound();
  return { db, account };
}

export async function approveLead(form: FormData) {
  const { db, account } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) throw new Error("Missing lead");
  await setLeadStatus(db, id, "approved", account);
  revalidatePath("/admin/early-access");
}

export async function declineLead(form: FormData) {
  const { db, account } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) throw new Error("Missing lead");
  await setLeadStatus(db, id, "declined", account);
  revalidatePath("/admin/early-access");
}
