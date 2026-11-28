"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/session";
import { mapRepoToTeam, recordInstallation } from "@/lib/github/app";

const withMsg = (path: string, msg: string) => `${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`;

export async function attachGithubInstallation(form: FormData) {
  const { db, viewer, account } = await currentViewer();
  try {
    const installationId = String(form.get("installationId") ?? "").trim();
    const accountLogin = String(form.get("accountLogin") ?? "").trim();
    if (!installationId || !accountLogin) throw new Error("Installation id and GitHub account are required");
    await recordInstallation(db, {
      orgId: viewer.orgId,
      installationId,
      accountLogin,
      installedByAccountId: account?.id ?? null,
    });
    revalidatePath("/", "layout");
    redirect(withMsg("/connect", `GitHub App install ${installationId} attached to this workspace.`));
  } catch (e) {
    redirect(withMsg("/connect", `Error: ${(e as Error).message}`));
  }
}

export async function mapGithubRepo(form: FormData) {
  const { db, viewer } = await currentViewer();
  try {
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
    revalidatePath("/", "layout");
    redirect(withMsg("/connect", `Mapped ${repoFullName} to this team. GitHub shows as Live.`));
  } catch (e) {
    redirect(withMsg("/connect", `Error: ${(e as Error).message}`));
  }
}
