import type { Level } from "./levels";

/**
 * Each field type renders itself at each disclosure level. Only these
 * rendered values ever leave the server; raw values stay inside it.
 */

export interface Rendered {
  level: Level;
  locked: boolean;
  /** Plain-text rendering, always present unless locked. */
  text: string | null;
  /** Structured detail, only at levels that allow it. */
  detail?: unknown;
}

export interface ReviewStatus {
  unit: string; // unit display name, e.g. "Fire prevention"
  state: "not_started" | "in_review" | "changes_requested" | "waiting" | "approved" | "complete";
  day?: number;
  of?: number;
  since?: string; // ISO date
  waiting_on?: string; // unit id
  waiting_on_name?: string;
  note?: string;
}
export interface Correction {
  n: number;
  title: string; // reviewer wording
  code?: string; // e.g. "Fire code 1006.3.4"
  plain: string; // applicant-facing wording
}
export interface Determination {
  subject: string;
  state: "pending" | "decided";
  proposed?: string;
  decision?: string;
  since?: string;
  note?: string;
}
export interface Person {
  member_id: string;
  name: string;
  role: string;
}

const STATE_LABEL: Record<ReviewStatus["state"], string> = {
  not_started: "Not started",
  in_review: "In review",
  changes_requested: "Changes requested",
  waiting: "Waiting",
  approved: "Approved",
  complete: "Complete",
};

export const fmtDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const firstSentence = (s: string) => {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
};

function reviewStatus(v: ReviewStatus, level: Level): Pick<Rendered, "text" | "detail"> {
  const label = v.state === "waiting" && v.waiting_on_name ? `Waiting on ${v.waiting_on_name}` : STATE_LABEL[v.state];
  const clock = v.day && v.of ? `day ${v.day} of ${v.of}` : null;
  switch (level) {
    case "full":
      return {
        text: [label, clock, v.since && `since ${fmtDate(v.since)}`].filter(Boolean).join(", ") + (v.note ? `. ${v.note}` : ""),
        detail: v,
      };
    case "summary":
      return { text: [label, clock, v.since && `since ${fmtDate(v.since)}`].filter(Boolean).join(", ") };
    case "status":
      return { text: [label, clock].filter(Boolean).join(", ") };
    default:
      return { text: `${v.unit} review: ${label.toLowerCase()}` };
  }
}

function corrections(v: Correction[], level: Level): Pick<Rendered, "text" | "detail"> {
  const n = v.length;
  switch (level) {
    case "full":
      return { text: v.map((c) => `${c.n}. ${c.title}${c.code ? ` (${c.code})` : ""}`).join("\n"), detail: v };
    case "summary":
      return { text: v.map((c) => `${c.n}. ${c.plain}`).join("\n"), detail: v.map(({ n, plain }) => ({ n, plain })) };
    case "status":
      return { text: n === 0 ? "No open corrections" : `${n} open correction${n === 1 ? "" : "s"}` };
    default:
      return { text: n === 0 ? "No corrections" : "Corrections requested" };
  }
}

function determination(v: Determination, level: Level): Pick<Rendered, "text" | "detail"> {
  const state = v.state === "pending" ? "Pending" : "Decided";
  switch (level) {
    case "full":
      return {
        text:
          v.state === "pending"
            ? `Pending${v.proposed ? `: ${v.proposed} proposed` : ""}${v.since ? `, since ${fmtDate(v.since)}` : ""}${v.note ? `. ${v.note}` : ""}`
            : `Decided: ${v.decision}${v.note ? `. ${v.note}` : ""}`,
        detail: v,
      };
    case "summary":
      return { text: v.state === "pending" ? `Pending${v.proposed ? `: ${v.proposed} proposed` : ""}` : `Decided: ${v.decision}` };
    case "status":
      return { text: state };
    default:
      return { text: `${v.subject}: ${state.toLowerCase()}` };
  }
}

function money(v: number, level: Level): Pick<Rendered, "text"> {
  switch (level) {
    case "full":
      return { text: `$${v.toLocaleString("en-US")}` };
    case "summary":
      return { text: v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K` };
    default:
      return { text: "Recorded" };
  }
}

function person(v: Person, level: Level): Pick<Rendered, "text" | "detail"> {
  switch (level) {
    case "full":
      return { text: `${v.name}, ${v.role}`, detail: v };
    case "summary":
      return { text: v.name };
    case "status":
      return { text: v.role };
    default:
      return { text: "Assigned" };
  }
}

function text(v: string, level: Level): Pick<Rendered, "text"> {
  switch (level) {
    case "full":
      return { text: v };
    case "summary":
      return { text: firstSentence(v) };
    default:
      return { text: "Provided" };
  }
}

function date(v: string, level: Level): Pick<Rendered, "text"> {
  return { text: level === "headline" ? "Set" : fmtDate(v) };
}

export function renderField(type: string, value: unknown, level: Level): Rendered {
  if (level === "none") return { level, locked: true, text: null };
  if (value === null || value === undefined) return { level, locked: false, text: null };
  const r =
    type === "review_status"
      ? reviewStatus(value as ReviewStatus, level)
      : type === "corrections"
        ? corrections(value as Correction[], level)
        : type === "determination"
          ? determination(value as Determination, level)
          : type === "money"
            ? money(value as number, level)
            : type === "person"
              ? person(value as Person, level)
              : type === "date"
                ? date(value as string, level)
                : text(String(value), level);
  return { level, locked: false, ...r };
}
