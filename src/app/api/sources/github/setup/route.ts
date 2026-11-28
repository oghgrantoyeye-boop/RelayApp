import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentViewer } from "@/lib/session";
import {
  GITHUB_SETUP_STATE_COOKIE,
  attachVerifiedInstallation,
  exchangeGithubUserCode,
  parseGithubSetupCookie,
  userCanAccessInstallation,
} from "@/lib/github/app";

/**
 * GitHub App setup redirect target.
 * Enable "Request user authorization (OAuth) during installation" on the App.
 * Setup URL: `{origin}/api/sources/github/setup`
 * Start from Connect (sets a CSRF cookie); callback must include `code` + `installation_id` + `state`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id")?.trim();
  const setupAction = url.searchParams.get("setup_action")?.trim();
  const stateParam = url.searchParams.get("state")?.trim() ?? null;
  const code = url.searchParams.get("code")?.trim();
  const connect = new URL("/connect", url.origin);
  const jar = await cookies();

  const clearState = () => jar.delete(GITHUB_SETUP_STATE_COOKIE);

  if (!installationId || (setupAction && setupAction !== "install" && setupAction !== "update")) {
    clearState();
    connect.searchParams.set("msg", "Error: Missing GitHub App installation id");
    return NextResponse.redirect(connect);
  }

  try {
    if (!code) {
      throw new Error(
        'Missing OAuth code. Turn on "Request user authorization (OAuth) during installation" on the GitHub App.',
      );
    }
    const orgId = parseGithubSetupCookie(jar.get(GITHUB_SETUP_STATE_COOKIE)?.value, stateParam);
    const { db, account, isSample } = await currentViewer();
    if (isSample) throw new Error("GitHub App installs aren't available in a sample workspace");
    if (!account) throw new Error("Sign in to attach a GitHub App");

    const membership = await db.one(`select role from org_membership where account_id = $1 and org_id = $2`, [
      account.id,
      orgId,
    ]);
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Only workspace owners or admins can manage the GitHub App");
    }

    const userToken = await exchangeGithubUserCode(code);
    if (!(await userCanAccessInstallation(userToken, installationId))) {
      throw new Error("You don't have access to that GitHub App installation");
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
  clearState();
  return NextResponse.redirect(connect);
}
