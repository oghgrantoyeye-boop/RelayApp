import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ingestCodingSession, userByToken } from "@/lib/sources";

// Called by beacon.mjs (served at /beacon.mjs) when Claude Code, Codex or Cursor finishes a session
// or turn. It adds to the token owner's rolling draft for today. Nothing is shared until they publish it.

async function viewerOf(req: Request) {
  const db = await getDb();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return { db, viewer: await userByToken(db, token) };
}

/** `beacon status`: checks the token and says whose it is. */
export async function GET(req: Request) {
  const { viewer } = await viewerOf(req);
  if (!viewer) return NextResponse.json({ error: "Unknown Beacon token" }, { status: 401 });
  return NextResponse.json({ ok: true, name: viewer.user.name, team: viewer.team.name });
}

export async function POST(req: Request) {
  const { db, viewer } = await viewerOf(req);
  if (!viewer) return NextResponse.json({ error: "Unknown Beacon token" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const r = await ingestCodingSession(db, viewer, body);
  const origin = new URL(req.url).origin;
  return NextResponse.json({ draft: r.updateId, items: r.items, review: `${origin}/write?draft=${r.updateId}` });
}
