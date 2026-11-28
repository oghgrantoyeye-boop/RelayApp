"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { accountFromSession, SESSION_COOKIE } from "@/lib/auth/accounts";
import { PERSONA_COOKIE, WORKSPACE_COOKIE, GUIDE_COOKIE } from "@/lib/session";
import { createWorkspace, inviteToWorkspace, createTeam, setTeamLead } from "@/lib/auth/workspace-setup";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function requireAccount() {
  const db = await getDb();
  const jar = await cookies();
  const account = await accountFromSession(db, jar.get(SESSION_COOKIE)?.value);
  if (!account) redirect("/signin");
  return { db, account, jar };
}

export async function createWorkspaceAction(form: FormData) {
  const { db, account, jar } = await requireAccount();
  let orgId: string;
  try {
    const created = await createWorkspace(db, account, {
      name: str(form, "name"),
      firstTeam: str(form, "firstTeam") || undefined,
    });
    orgId = created.orgId;
    jar.set(WORKSPACE_COOKIE, orgId, { path: "/", sameSite: "lax", httpOnly: true });
    jar.set(PERSONA_COOKIE, created.userId, { path: "/", sameSite: "lax", httpOnly: true });
    jar.delete(GUIDE_COOKIE);
  } catch (e) {
    redirect(`/signin/create?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/", "layout");
  redirect("/workspace/people");
}

export async function invitePersonAction(form: FormData) {
  const { db, account } = await requireAccount();
  const orgId = str(form, "orgId");
  try {
    await inviteToWorkspace(db, account, orgId, {
      email: str(form, "email"),
      unitId: str(form, "unitId") || undefined,
      role: str(form, "role") === "admin" ? "admin" : "member",
    });
  } catch (e) {
    redirect(`/workspace/people?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/workspace/people");
  redirect("/workspace/people?msg=" + encodeURIComponent("Invite sent."));
}

export async function createTeamAction(form: FormData) {
  const { db, account } = await requireAccount();
  const orgId = str(form, "orgId");
  try {
    await createTeam(db, account, orgId, {
      name: str(form, "name"),
      description: str(form, "description") || undefined,
      leadUserId: str(form, "leadUserId") || undefined,
    });
  } catch (e) {
    redirect(`/workspace/people?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/workspace/people");
  redirect("/workspace/people?msg=" + encodeURIComponent("Team created."));
}

export async function setLeadAction(form: FormData) {
  const { db, account } = await requireAccount();
  const orgId = str(form, "orgId");
  try {
    await setTeamLead(db, account, orgId, str(form, "unitId"), str(form, "leadUserId"));
  } catch (e) {
    redirect(`/workspace/people?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/workspace/people");
  redirect("/workspace/people?msg=" + encodeURIComponent("Lead updated."));
}
