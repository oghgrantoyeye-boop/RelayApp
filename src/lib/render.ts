// Turns a stored item into what a reader may see at their level. Only the text for that level
// leaves the server; nothing more detailed is sent and hidden in the browser.
import type { Level } from "./permissions";
import type { Row } from "./db";
import { fmt } from "./clock";

export const KIND_LABEL: Record<string, string> = {
  progress: "Progress",
  decision: "Decision",
  risk: "Risk",
  ask: "Ask",
  answer: "Answer",
};

export interface ShownItem {
  level: Level;
  text: string;
  detail?: string;
}

export function showUpdateItem(row: Row, level: Level): ShownItem | null {
  switch (level) {
    case "full":
      return { level, text: row.text };
    case "summary":
      return { level, text: row.summary_text };
    case "status":
      return { level, text: `${KIND_LABEL[row.kind] ?? row.kind}: ${row.headline_text}` };
    case "headline":
      return { level, text: row.headline_text };
    default:
      return null;
  }
}

export interface ShownRequest {
  level: Level;
  title: string;
  details?: string;
}

export function showRequest(row: Row, level: Level, names: { from: string; to: string }): ShownRequest | null {
  const restricted = !!row.marking_id;
  switch (level) {
    case "full":
      return { level, title: row.title, details: row.details };
    case "summary":
      if (restricted && !row.summary_title) return { level, title: `Request from ${names.from} (details restricted)` };
      return { level, title: row.summary_title ?? row.title, details: row.summary_details ?? row.details };
    case "status":
      return { level, title: `Request from ${names.from} to ${names.to}: ${row.status}` };
    case "headline":
      return { level, title: row.headline_text ?? `Request from ${names.from} to ${names.to}` };
    default:
      return null;
  }
}

export interface ShownCommitment {
  level: Level;
  title: string;
  reason?: string;
}

export function showCommitment(row: Row, level: Level, ownerName: string): ShownCommitment | null {
  const restricted = !!row.marking_id;
  switch (level) {
    case "full":
      return { level, title: row.title, reason: row.slip_reason ?? undefined };
    case "summary":
      return restricted
        ? { level, title: `${ownerName} commitment (details restricted)` }
        : { level, title: row.title, reason: row.slip_reason ?? undefined };
    case "status":
    case "headline":
      return { level, title: `${ownerName} commitment due ${fmt(row.due_date)}` };
    default:
      return null;
  }
}

export interface ShownSource {
  level: Level;
  title: string;
  text?: string;
  status?: string;
}

/** Synced items from a team's tools. Raw chat never leaves the team; tickets and docs can, if shared. */
export function showSource(row: Row, level: Level): ShownSource | null {
  const ref = row.external_ref ? `${row.external_ref} ` : "";
  if (level === "none") return null;
  // Tool content has no redacted versions, so a marked item shows nothing below full detail.
  if (row.marking_id && level !== "full") return null;
  switch (row.kind) {
    case "message":
      return level === "full" ? { level, title: row.title, text: row.body } : null;
    case "ticket":
    case "pr":
      if (level === "full") return { level, title: `${ref}${row.title}`, text: row.body, status: row.status ?? undefined };
      if (level === "summary") return { level, title: `${ref}${row.title}`, status: row.status ?? undefined };
      if (level === "status") return { level, title: `${ref.trim() || row.kind}`, status: row.status ?? undefined };
      return null;
    case "doc":
      if (level === "full") return { level, title: row.title, text: row.body };
      if (level === "summary") return { level, title: row.title, text: (row.body.match(/^.+?[.!?](\s|$)/)?.[0] ?? row.body).trim() };
      return { level, title: row.title };
    default:
      return null;
  }
}
