// The integrations section of the marketing site. "Available" means it works in Beacon today;
// everything else is planned and appears in the interactive demo with sample data only.
import Link from "next/link";
import { BeaconMark } from "./Brand";
import { AppMark, NAMES, SvgMark } from "./Logos";

type Status = "live" | "planned";
interface Tool {
  id: string;
  status: Status;
  what: string;
}

export const GROUPS: { name: string; tools: Tool[] }[] = [
  {
    name: "Engineering",
    tools: [
      { id: "github", status: "live", what: "Merged pull requests teach Beacon what each team runs and works on." },
      { id: "claude", status: "live", what: "A session hook drafts what you worked on, so your team's picture stays current." },
      { id: "jira", status: "planned", what: "Tickets show what a team is working on and what it gets asked." },
      { id: "linear", status: "planned", what: "Issues show what a team is working on and what it gets asked." },
    ],
  },
  {
    name: "Conversations and meetings",
    tools: [
      { id: "slack", status: "live", what: "Questions and answers posted to a channel. Learning from team channels and asking from Slack are planned." },
      { id: "zoom", status: "planned", what: "Meeting summaries teach Beacon what a team decided and knows." },
      { id: "gmeet", status: "planned", what: "Meeting summaries teach Beacon what a team decided and knows." },
      { id: "teams", status: "planned", what: "Meeting transcripts and delivery for Microsoft 365 companies." },
    ],
  },
  {
    name: "Docs and knowledge",
    tools: [
      { id: "notion", status: "planned", what: "Specs and runbooks, shared at the right level of detail." },
      { id: "confluence", status: "planned", what: "Pages findable by the teams that depend on them." },
      { id: "gdrive", status: "planned", what: "Plans and docs linked to the decisions they record." },
    ],
  },
  {
    name: "Customers and design",
    tools: [
      { id: "hubspot", status: "planned", what: "Customer questions routed to the team that can answer them." },
      { id: "zendesk", status: "planned", what: "Escalations routed to the team that owns the area." },
      { id: "figma", status: "planned", what: "Design files linked to the team that owns them." },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.tools);
const C = { x: 500, y: 228 };

/** Beacon in the middle, every tool around it. Solid, moving lines are connections that work today. */
function Hub() {
  const n = ALL.length;
  const nodes = ALL.map((t, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const cos = Math.cos(a);
    // Labels go outside the ring: beside the node on the left and right, above it on top, below it underneath.
    const side = Math.abs(cos) > 0.75;
    return { ...t, x: C.x + cos * 380, y: C.y + Math.sin(a) * 170, side, cos, top: Math.sin(a) < 0 };
  });
  const edge = (x: number, y: number) => {
    const dx = C.x - x;
    const dy = C.y - y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    return `M${(x + ux * 30).toFixed(1)},${(y + uy * 30).toFixed(1)} L${(C.x - ux * 50).toFixed(1)},${(C.y - uy * 50).toFixed(1)}`;
  };
  return (
    <div className="hub">
      <svg viewBox="0 0 1000 460" width="100%" role="img" aria-label="Beacon connected to the tools teams use. GitHub, Claude Code and Slack work today; the rest are planned. The list below has the details.">
        {nodes.map((t) => (
          <g key={t.id}>
            {t.status === "live" ? (
              <>
                <path d={edge(t.x, t.y)} stroke="#315efb" strokeWidth="1.8" fill="none" />
                <path d={edge(t.x, t.y)} className="hub-pulse" stroke="#d9a45b" strokeWidth="3.2" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <path d={edge(t.x, t.y)} stroke="#cfcac0" strokeWidth="1.4" strokeDasharray="3 6" fill="none" />
            )}
          </g>
        ))}
        <circle cx={C.x} cy={C.y} r="48" fill="#172333" />
        <circle cx={C.x} cy={C.y} r="58" fill="none" stroke="#315efb" strokeOpacity="0.25" strokeWidth="1.5" />
        <g transform={`translate(${C.x - 21} ${C.y - 23})`} style={{ color: "#fff" }}>
          <BeaconMark size={42} />
        </g>
        {nodes.map((t) => (
          <g key={t.id}>
            <circle cx={t.x} cy={t.y} r="27" fill="#fff" stroke={t.status === "live" ? "#315efb" : "#e5e3de"} strokeWidth={t.status === "live" ? 2 : 1.4} />
            <SvgMark id={t.id} x={t.x - 13} y={t.y - 13} size={26} />
            <text
              x={t.side ? t.x + Math.sign(t.cos) * 36 : t.x}
              y={t.side ? t.y + 4.5 : t.top ? t.y - 36 : t.y + 46}
              textAnchor={t.side ? (t.cos > 0 ? "start" : "end") : "middle"}
              fontSize="13" fill={t.status === "live" ? "#17191d" : "#68717e"} fontWeight={t.status === "live" ? 600 : 400}>
              {NAMES[t.id]}
            </text>
          </g>
        ))}
      </svg>
      <div className="hub-legend" aria-hidden="true">
        <span><i className="live" />Available now</span>
        <span><i className="planned" />Planned, shown in the demo with sample data</span>
      </div>
    </div>
  );
}

export function Integrations() {
  return (
    <section className="section" id="integrations" aria-labelledby="int-title">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Integrations</span>
          <h2 id="int-title" className="h2">Works with the tools your teams already use.</h2>
          <p className="lede" style={{ marginTop: 18 }}>
            Beacon learns from the work where it already happens: code, tickets, docs, meetings and conversations.
          </p>
        </div>
        <Hub />
        <div className="int-groups">
          {GROUPS.map((g) => (
            <div key={g.name} className="int-group">
              <h3>{g.name}</h3>
              <ul>
                {g.tools.map((t) => (
                  <li key={t.id} className="int-tile">
                    <span className="int-mark"><AppMark id={t.id} size={22} /></span>
                    <div>
                      <div className="nm">
                        {NAMES[t.id]}
                        <span className={`status ${t.status}`}>{t.status === "live" ? "Available" : "Planned"}</span>
                      </div>
                      <p>{t.what}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="int-note">
          <span>
            Available now: GitHub, Claude Code and Slack channel notifications. Planned integrations appear in the interactive demo with sample
            data from a fictional company. They don&apos;t connect to real accounts yet.
          </span>
          <span className="int-links">
            <Link href="/connect">See them in the demo →</Link>
            <Link href="/early-access">Need another tool? Tell us →</Link>
          </span>
        </p>
      </div>
    </section>
  );
}
