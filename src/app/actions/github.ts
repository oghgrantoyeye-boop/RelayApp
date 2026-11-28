"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/session";
import { attachVerifiedInstallation, mapRepoToTeam } from "@/lib/github/app";

const withMsg = (path: string, msg: string) => `${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`;

async function requireGithubAdmin() {
  const ctx = await currentViewer();
  if (ctx.isSample) throw new Error("GitHub App installs aren't available in a sample workspace");
  if (!ctx.account) throw new Error("Sign in to attach a GitHub App");
  const membership = await ctx.db.one(`select role from org_membership where account_id = $1 and org_id = $2`, [
    ctx.account.id,
    ctx.viewer.orgId,
  ]);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new Error("Only workspace owners or admins can manage the GitHub App");
  }
  return ctx;
}

export async function attachGithubInstallation(form: FormData) {
  let msg: string;
  try {
    const { db, viewer, account } = await requireGithubAdmin();
    const installationId = String(form.get("installationId") ?? "").trim();
    if (!installationId) throw new Error("Installation id is required");
    // Attach only after verifying the installation with the App JWT (never trust typed org login alone).
    await attachVerifiedInstallation(db, {
      orgId: viewer.orgId,
      installationId,
      installedByAccountId: account!.id,
    });
    msg = `GitHub App install ${installationId} attached to this workspace.`;
  } catch (e) {
    msg = `Error: ${(e as Error).message}`;
  }
  revalidatePath("/", "layout");
  redirect(withMsg("/connect", msg));
}

export async function mapGithubRepo(form: FormData) {
  let msg: string;
  try {
    const { db, viewer } = await requireGithubAdmin();
    const installationId = String(form.get("installationId") ?? "").trim();
    const repoFullName = String(form.get("repo") ?? "").trim();
    const unitId = String(form.get("unitId") ?? "").trim() || viewer.team.id;
    if (!installationId || !repoFullName) throw new Error("Installation and repository are required");
    await mapRepoToTeam(db, {
      orgId: viewer.orgId,
      installationId,
      repoFullName,
      unitId,
      actorId: viewer.user.id,
    });
    msg = `Mapped ${repoFullName} to this team. GitHub shows as Live.`;
  } catch (e) {
    msg = `Error: ${(e as Error).message}`;
  }
  revalidatePath("/", "layout");
  redirect(withMsg("/connect", msg));
}
