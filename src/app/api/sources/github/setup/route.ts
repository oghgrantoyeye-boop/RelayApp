import { NextResponse } from "next/server";
import { currentViewer } from "@/lib/session";
import { attachVerifiedInstallation } from "@/lib/github/app";

/**
 * GitHub App setup redirect target.
 * Configure the App's "Setup URL" to `{origin}/api/sources/github/setup` and pass `state=<orgId>`
 * on the install link so we know which workspace to attach.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id")?.trim();
  const setupAction = url.searchParams.get("setup_action")?.trim();
  const stateOrg = url.searchParams.get("state")?.trim();
  const connect = new URL("/connect", url.origin);

  if (!installationId || (setupAction && setupAction !== "install" && setupAction !== "update")) {
    connect.searchParams.set("msg", "Error: Missing GitHub App installation id");
    return NextResponse.redirect(connect);
  }

  try {
    const { db, viewer, account, isSample } = await currentViewer();
    if (isSample) throw new Error("GitHub App installs aren't available in a sample workspace");
    if (!account) throw new Error("Sign in to attach a GitHub App");
    const orgId = stateOrg || viewer.orgId;
    if (stateOrg && stateOrg !== viewer.orgId) {
      // Only attach to the workspace named in state when the signed-in account belongs to it.
      const membership = await db.one(`select role from org_membership where account_id = $1 and org_id = $2`, [
        account.id,
        stateOrg,
      ]);
      if (!membership) throw new Error("You are not a member of that workspace");
      if (membership.role !== "owner" && membership.role !== "admin") {
        throw new Error("Only workspace owners or admins can manage the GitHub App");
      }
    } else {
      const membership = await db.one(`select role from org_membership where account_id = $1 and org_id = $2`, [
        account.id,
        orgId,
      ]);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw new Error("Only workspace owners or admins can manage the GitHub App");
      }
    }
    await attachVerifiedInstallation(db, {
      orgId,
      installationId,
      installedByAccountId: account.id,
    });
    connect.searchParams.set("msg", `GitHub App install ${installationId} attached to this workspace.`);
  } catch (e) {
    connect.searchParams.set("msg", `Error: ${(e as Error).message}`);
  }
  return NextResponse.redirect(connect);
}
