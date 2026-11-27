// Logos for the marketing site. Marks come from Simple Icons (see marks.ts). Slack, Microsoft Teams and
// Toast aren't in that set because those companies restrict use of their logos, so they're
// set as plain type. If you have the right to use an official logo, save it as public/logos/<id>.svg
// and it replaces the typeset version everywhere on the site.
import fs from "node:fs";
import path from "node:path";
import { MARKS } from "./marks";

export const NAMES: Record<string, string> = {
  github: "GitHub",
  claude: "Claude Code",
  jira: "Jira",
  linear: "Linear",
  slack: "Slack",
  zoom: "Zoom",
  gmeet: "Google Meet",
  teams: "Microsoft Teams",
  notion: "Notion",
  confluence: "Confluence",
  gdrive: "Google Drive",
  hubspot: "HubSpot",
  zendesk: "Zendesk",
  figma: "Figma",
  toast: "Toast",
};

/** Path of an official logo file in public/logos, if one was added. Read at build time. */
export function logoFile(id: string): string | null {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", "logos", `${id}.svg`)) ? `/logos/${id}.svg` : null;
  } catch {
    return null;
  }
}

// A neutral chat glyph for tools without a mark here. It is deliberately not either company's logo.
const CHAT = "M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z";

/** The tool's mark at `size`, in brand color (or currentColor with `mono`). For use inside HTML. */
export function AppMark({ id, size = 22, mono = false }: { id: string; size?: number; mono?: boolean }) {
  const file = logoFile(id);
  // eslint-disable-next-line @next/next/no-img-element
  if (file) return <img src={file} alt="" width={size} height={size} style={{ objectFit: "contain" }} />;
  const m = MARKS[id];
  if (!m)
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="#68717e" strokeWidth="1.7" strokeLinejoin="round">
        <path d={CHAT} />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill={mono ? "currentColor" : m.hex}>
      <path d={m.path} />
    </svg>
  );
}

/** The same mark, placed inside a parent SVG at (x, y) as its top-left corner. */
export function SvgMark({ id, x, y, size }: { id: string; x: number; y: number; size: number }) {
  const file = logoFile(id);
  if (file) return <image href={file} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid meet" />;
  const m = MARKS[id];
  if (!m)
    return (
      <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#68717e" strokeWidth="1.7" strokeLinejoin="round">
        <path d={CHAT} />
      </svg>
    );
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill={m.hex}>
      <path d={m.path} />
    </svg>
  );
}

/** A company name set as a wordmark, or its official logo if one was added to public/logos. */
export function Wordmark({ id, height = 34 }: { id: string; height?: number }) {
  const file = logoFile(id);
  // eslint-disable-next-line @next/next/no-img-element
  if (file) return <img src={file} alt={NAMES[id] ?? id} height={height} style={{ height, width: "auto" }} />;
  return <span className="wordmark" style={{ fontSize: height }}>{NAMES[id] ?? id}</span>;
}
