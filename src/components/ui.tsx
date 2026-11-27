import Link from "next/link";
import type { ReactNode } from "react";
import type { Level } from "@/lib/permissions";
import { LEVEL_LABEL } from "@/lib/permissions";
import type { CommitmentState } from "@/lib/commitments";

export type Tone = "green" | "amber" | "red" | "blue" | "violet" | "gray";

export function Pill({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

const KIND_TONE: Record<string, Tone> = { decision: "blue", risk: "amber", ask: "violet", progress: "green", answer: "gray" };
const KIND_NAME: Record<string, string> = { decision: "Decision", risk: "Risk", ask: "Ask", progress: "Progress", answer: "Answer" };

export function KindPill({ kind }: { kind: string }) {
  return <Pill tone={KIND_TONE[kind] ?? "gray"}>{KIND_NAME[kind] ?? kind}</Pill>;
}

const STATE: Record<CommitmentState, [Tone, string]> = {
  on_track: ["green", "On track"],
  at_risk: ["amber", "At risk"],
  slipped: ["red", "Slipped"],
  done: ["gray", "Done"],
  draft: ["violet", "Draft: confirm"],
  rejected: ["gray", "Rejected"],
};

export function StatePill({ state, daysLate }: { state: CommitmentState; daysLate?: number }) {
  const [tone, label] = STATE[state];
  return <Pill tone={tone}>{state === "slipped" && daysLate ? `Slipped ${daysLate}d` : label}</Pill>;
}

/** Shows which disclosure level the reader is seeing, so the boundaries are visible in the demo. */
export function LevelTag({ level }: { level: Level }) {
  return (
    <span className="level" title={`You see this at ${LEVEL_LABEL[level]}`}>
      {LEVEL_LABEL[level]}
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TeamChip({ team }: { team: { name: string; slug: string; color?: string } | Record<string, any> }) {
  return (
    <Link href={`/teams/${team.slug}`} className="chip">
      <span className="swatch" style={{ background: team.color ?? "#71717a" }} />
      {team.name}
    </Link>
  );
}

export function initials(name: string): string {
  return name
    .replace(/ agent$/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** An illustrated headshot for a person (see /api/avatar), or "AI" for an agent. */
export function Avatar({ name, agent, size }: { name: string; agent?: boolean; size?: number }) {
  const style = size ? { width: size, height: size } : undefined;
  if (agent || / agent$/.test(name)) {
    return <span className="av agent" title={name} aria-hidden="true" style={style}>AI</span>;
  }
  return (
    <span className="av photo" title={name} aria-hidden="true" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/avatar/${encodeURIComponent(name)}`} alt="" loading="lazy" />
    </span>
  );
}

const PATHS: Record<string, ReactNode> = {
  feed: <path d="M4 6h16M4 12h16M4 18h10" />,
  asks: (<><path d="M4 13l2-8h12l2 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></>),
  commitments: (<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
  write: (<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>),
  directory: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  digest: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>),
  inbox: (<><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></>),
  audit: <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" />,
  connect: (<><path d="M9 7H6a4 4 0 0 0 0 8h3M15 7h3a4 4 0 0 1 0 8h-3M8 11h8" /></>),
  spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  search: (<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>),
  agent: (<><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6" /></>),
  meetings: (<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></>),
  map: (<><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8.3 7l7.4.6M7.3 8.2l3.6 7.6M16.8 9.2l-3.6 6.6" /></>),
};

export function Icon({ name, size = 15 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function Topbar({ crumbs, children }: { crumbs: (string | { href: string; label: string })[]; children?: ReactNode }) {
  return (
    <header className="topbar">
      <nav aria-label="Breadcrumb" className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} className="row" style={{ gap: 8 }}>
            {i > 0 && <span className="sep" aria-hidden="true">/</span>}
            {typeof c === "string" ? <span style={{ fontWeight: 500 }}>{c}</span> : <Link href={c.href} className="muted">{c.label}</Link>}
          </span>
        ))}
      </nav>
      {children && <div className="actions">{children}</div>}
    </header>
  );
}

export function Flash({ msg }: { msg?: string | string[] }) {
  const m = Array.isArray(msg) ? msg[0] : msg;
  if (!m) return null;
  const isErr = m.startsWith("Error:");
  return <div className={`notice${isErr ? " err" : ""}`} role="status" style={{ marginBottom: 16 }}>{isErr ? m.slice(6).trim() : m}</div>;
}
