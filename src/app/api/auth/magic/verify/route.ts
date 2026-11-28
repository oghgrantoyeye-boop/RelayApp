import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { consumeMagicLink } from "@/lib/auth/magic";
import { SESSION_COOKIE } from "@/lib/auth/accounts";
import { EarlyAccessError } from "@/lib/auth/early-access";

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const token = url.searchParams.get("token");
    if (!token) throw new Error("Missing sign-in token");
    const db = await getDb();
    const { sessionToken, expiresAt } = await consumeMagicLink(db, token);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, sessionToken, { path: "/", httpOnly: true, sameSite: "lax", expires: expiresAt });
    return NextResponse.redirect(new URL("/signin", url.origin));
  } catch (e) {
    if (e instanceof EarlyAccessError) return NextResponse.redirect(new URL("/signin/waitlist", url.origin));
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent((e as Error).message)}`, url.origin));
  }
}
