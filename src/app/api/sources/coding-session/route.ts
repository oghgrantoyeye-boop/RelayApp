import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ingestCodingSession, userByToken } from "@/lib/sources";

// Called by integrations/claude-code/relay-hook.mjs when a coding-agent session ends.
// It creates a draft for the token's owner. Nothing is shared until they publish it.
export async function POST(req: Request) {
  const db = await getDb();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const viewer = await userByToken(db, token);
  if (!viewer) return NextResponse.json({ error: "Unknown Relay token" }, { status: 401 });
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
