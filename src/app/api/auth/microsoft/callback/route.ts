import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { exchangeMicrosoftCode, readOAuthState } from "@/lib/auth/oauth";
import { createSession, SESSION_COOKIE, UnverifiedEmailError, upsertAccount } from "@/lib/auth/accounts";
import { EarlyAccessError } from "@/lib/auth/early-access";

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const { next } = readOAuthState(url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Microsoft did not return a code");
    const profile = await exchangeMicrosoftCode(code);
    const db = await getDb();
    const account = await upsertAccount(db, {
      email: profile.email,
      name: profile.name,
      microsoftSub: profile.sub,
      emailVerified: profile.emailVerified,
    });
    const { token, expiresAt } = await createSession(db, account.id);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", expires: expiresAt });
    return NextResponse.redirect(new URL(next.includes("workspaces") ? next : "/signin", url.origin));
  } catch (e) {
    if (e instanceof EarlyAccessError) return NextResponse.redirect(new URL("/signin/waitlist", url.origin));
    if (e instanceof UnverifiedEmailError) {
      return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent("Your email is not verified with Microsoft")}`, url.origin));
    }
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent((e as Error).message)}`, url.origin));
  }
}
