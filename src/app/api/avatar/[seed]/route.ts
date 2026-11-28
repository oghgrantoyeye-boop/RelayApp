// Illustrated headshots for the demo's fictional people. Drawn locally from the name with DiceBear's
// "Notionists" style (CC0 1.0, a remix of work by Zoish), so no real photos and no outside requests.
// Agents ("bot:" seeds) get DiceBear's "Bottts Neutral" robot faces (Bottts by Pablo Stanley,
// free for personal and commercial use), so an agent never looks like a person.
import { createAvatar } from "@dicebear/core";
import { botttsNeutral, notionists } from "@dicebear/collection";

const BACKGROUNDS = ["dbeafe", "fde68a", "fecaca", "d9f99d", "e9d5ff", "fbcfe8", "bae6fd", "fed7aa"];

export async function GET(_req: Request, { params }: { params: Promise<{ seed: string }> }) {
  const { seed } = await params;
  const s = decodeURIComponent(seed).slice(0, 80);
  const svg = s.startsWith("bot:")
    ? createAvatar(botttsNeutral, { seed: s.slice(4), radius: 50 }).toString()
    : createAvatar(notionists, { seed: s, backgroundColor: BACKGROUNDS, radius: 50 }).toString();
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=31536000, immutable" },
  });
}
