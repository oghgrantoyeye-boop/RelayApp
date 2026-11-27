import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ingestPullRequest, verifyGithubSignature } from "@/lib/sources";

// GitHub webhook (content type application/json, "Pull requests" events). Set GITHUB_WEBHOOK_SECRET
// to verify signatures. A merged PR becomes a draft progress item for its author's team.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyGithubSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event");
  if (event === "ping") return NextResponse.json({ ok: true });
  if (event && event !== "pull_request") return NextResponse.json({ skipped: `ignored ${event}` }, { status: 202 });
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const db = await getDb();
  const r = await ingestPullRequest(db, payload);
  return NextResponse.json(r, { status: "skipped" in r ? 202 : 200 });
}
