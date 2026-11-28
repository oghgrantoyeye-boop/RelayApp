import { NextResponse } from "next/server";
import { googleAuthUrl, makeOAuthState } from "@/lib/auth/oauth";
import { googleConfigured } from "@/lib/auth/config";

export async function GET(req: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/signin?error=Google%20sign-in%20is%20not%20configured", req.url));
  }
  const next = new URL(req.url).searchParams.get("next") || "/signin";
  return NextResponse.redirect(googleAuthUrl(makeOAuthState(next)));
}
