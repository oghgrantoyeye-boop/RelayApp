// Illustrated headshots for the demo's fictional people. Drawn locally from the name with DiceBear's
// "Notionists" style (CC0 1.0, a remix of work by Zoish), so no real photos and no outside requests.
import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";

const BACKGROUNDS = ["dbeafe", "fde68a", "fecaca", "d9f99d", "e9d5ff", "fbcfe8", "bae6fd", "fed7aa"];

export async function GET(_req: Request, { params }: { params: Promise<{ seed: string }> }) {
  const { seed } = await params;
  const svg = createAvatar(notionists, { seed: decodeURIComponent(seed).slice(0, 80), backgroundColor: BACKGROUNDS, radius: 50 }).toString();
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=31536000, immutable" },
  });
}
