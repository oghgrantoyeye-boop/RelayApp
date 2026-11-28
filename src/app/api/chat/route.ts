import { cookies } from "next/headers";
import { currentViewer, DOCK_COOKIE } from "@/lib/session";

// The agent chat: one message in, the reply streamed back as plain text while it's written.
// The page refreshes afterwards to show the saved reply with its sources and buttons.
export const maxDuration = 120;

export async function POST(req: Request) {
  // Same-origin only, like a server action: a page on another site can't post as the viewer.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host && origin !== process.env.NEXT_PUBLIC_SITE_URL) {
    return new Response("Forbidden", { status: 403 });
  }
  let body: { target?: string; text?: string; from?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Expected JSON", { status: 400 });
  }
  const text = String(body.text ?? "").trim();
  if (!text) return new Response("Type a message first.", { status: 400 });

  const { db, viewer } = await currentViewer();
  const { sendChat, resolveMention } = await import("@/lib/assistant");
  let target = String(body.target ?? "") || "me";
  const mention = await resolveMention(db, viewer.orgId, text);
  if (mention) target = mention.agent.id;
  if (body.from === "dock") (await cookies()).set(DOCK_COOKIE, target, { path: "/", sameSite: "lax", httpOnly: true });

  // One JSON event per line: {t:"d"} text, {t:"s"} a step starting or done, {t:"e"} an error.
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: Record<string, unknown>) => {
        try {
          controller.enqueue(enc.encode(`${JSON.stringify(ev)}\n`));
        } catch {
          // The person stopped or left; the reply is still saved.
        }
      };
      try {
        await sendChat(db, viewer, { target, text }, {
          onDelta: (v) => send({ t: "d", v }),
          onStep: (s) => send({ t: "s", v: s.label, done: s.done }),
          signal: req.signal,
        });
      } catch (err) {
        send({ t: "e", v: `Sorry, that didn't go through: ${(err as Error).message}` });
      }
      try {
        controller.close();
      } catch {
        // Already closed.
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-beacon-target": target },
  });
}
