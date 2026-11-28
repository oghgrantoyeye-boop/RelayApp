"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/session";
import {
  GITHUB_SETUP_STATE_COOKIE,
  createGithubSetupState,
  githubAppConfigured,
  githubAppInstallUrl,
  mapRepoToTeam,
} from "@/lib/github/app";

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

/** Set CSRF state cookie and send the owner to GitHub's install page. */
export async function startGithubAppInstall() {
  let target: string;
  try {
    const { viewer } = await requireGithubAdmin();
    if (!githubAppConfigured()) throw new Error("GitHub App credentials are not configured on this server");
    const { state, cookieValue } = createGithubSetupState(viewer.orgId);
    const url = githubAppInstallUrl(undefined, state);
    if (!url) throw new Error("Set GITHUB_APP_SLUG so Beacon can build the install link");
    (await cookies()).set(GITHUB_SETUP_STATE_COOKIE, cookieValue, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 600,
      secure: process.env.NODE_ENV === "production",
    });
    target = url;
  } catch (e) {
    target = withMsg("/connect", `Error: ${(e as Error).message}`);
  }
  redirect(target);
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
