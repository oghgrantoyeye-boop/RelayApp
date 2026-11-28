import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleGithubAppEvent, verifyGithubAppSignature } from "@/lib/github/app";

// GitHub App webhook (and legacy per-repo webhook). Prefer GITHUB_APP_WEBHOOK_SECRET;
// fall back to GITHUB_WEBHOOK_SECRET. installation / pull_request / pull_request_review.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyGithubAppSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const db = await getDb();
  const r = await handleGithubAppEvent(db, event, payload);
  const status = "error" in r ? 400 : "skipped" in r ? 202 : 200;
  return NextResponse.json(r, { status });
}
