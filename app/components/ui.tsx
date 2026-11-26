import type { ReactNode } from "react";
import type { Level } from "@/lib/levels";
import { LEVEL_LABEL } from "@/lib/levels";

const P: Record<string, ReactNode> = {
  home: <path d="M4 11l8-7 8 7v9H4z" />,
  units: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  iface: <path d="M7 7h10l-3-3M17 17H7l3 3" />,
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 20h4" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </>
  ),
  chev: <path d="M8 10l4 4 4-4" />,
};

export function Icon({ name, size = 15 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

export type Tone = "green" | "amber" | "red" | "blue" | "gray" | "violet";

export function Pill({ tone = "gray", dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`pill pill-${tone}`}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}

export function Tag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="tag">
      <span className="swatch" style={{ background: color }} />
      {children}
    </span>
  );
}

const LEVEL_TONE: Record<Level, Tone> = { full: "blue", summary: "amber", status: "green", headline: "violet", none: "gray" };
export function LevelPill({ level }: { level: Level }) {
  return (
    <Pill tone={LEVEL_TONE[level]} dot={false}>
      {LEVEL_LABEL[level]}
    </Pill>
  );
}

const STATE_TONE: Record<string, Tone> = {
  done: "green",
  approved: "green",
  in_progress: "blue",
  changes_requested: "red",
  waiting: "amber",
  not_started: "gray",
  locked: "gray",
};
export const stateTone = (s: string): Tone => STATE_TONE[s] ?? "gray";

export function Avatar({ name, agent = false, size = 22 }: { name: string; agent?: boolean; size?: number }) {
  const ini = agent ? "AI" : name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className={`av${agent ? " av-agent" : ""}`} style={{ width: size, height: size }}>
      {ini}
    </span>
  );
}

export function Locked({ label = "Not shared with you" }: { label?: string }) {
  return (
    <span className="locked">
      <Icon name="lock" size={13} />
      {label}
    </span>
  );
}

export function TopBar({ crumbs, children }: { crumbs: { label: string; href?: string }[]; children?: ReactNode }) {
  return (
    <header className="topbar">
      <nav aria-label="Breadcrumb" className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} className="crumb">
            {i > 0 && <span aria-hidden="true" className="crumb-sep">/</span>}
            {c.href ? <a href={c.href}>{c.label}</a> : <span className="crumb-current">{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="topbar-right">{children}</div>
    </header>
  );
}

export function AiCard({ title, children, sources, markings = [] }: { title: string; children: ReactNode; sources: { name: string; color: string }[]; markings?: string[] }) {
  return (
    <section aria-label={title} className="card ai-card">
      <div className="ai-head">
        <span className="ai-title">
          <Icon name="spark" size={14} />
          {title}
        </span>
        <span className="ai-sources">
          <span className="muted small">Sources</span>
          {sources.map((s) => (
            <Tag key={s.name} color={s.color}>
              {s.name}
            </Tag>
          ))}
        </span>
      </div>
      <div className="ai-body">{children}</div>
      {markings.length > 0 && (
        <div className="ai-markings">
          {markings.map((m) => (
            <Pill key={m} tone="red" dot={false}>
              <Icon name="lock" size={12} /> {m}
            </Pill>
          ))}
        </div>
      )}
    </section>
  );
}

export function Metric({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: Tone }) {
  return (
    <div className="metric">
      <div className="muted small">{label}</div>
      <div className="metric-value">{value}</div>
      {note && <div className={`small ${tone ? `tone-${tone}` : "muted"}`}>{note}</div>}
    </div>
  );
}

export const fmtDay = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${fmtDay(d.toISOString())}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}`;
};
