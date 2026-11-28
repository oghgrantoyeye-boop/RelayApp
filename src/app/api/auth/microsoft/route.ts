import { NextResponse } from "next/server";
import { microsoftAuthUrl, makeOAuthState } from "@/lib/auth/oauth";
import { microsoftConfigured } from "@/lib/auth/config";

export async function GET(req: Request) {
  if (!microsoftConfigured()) {
    return NextResponse.redirect(new URL("/signin?error=Microsoft%20sign-in%20is%20not%20configured", req.url));
  }
  const next = new URL(req.url).searchParams.get("next") || "/signin";
  return NextResponse.redirect(microsoftAuthUrl(makeOAuthState(next)));
}
