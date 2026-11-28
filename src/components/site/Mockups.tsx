// Static product mockups for the marketing site. Everything here is illustrative data about a
// fictional company (Northwind Labs) and is labelled as such where it appears.
import { BeaconMark } from "./Brand";
import { SvgMark } from "./Logos";

type Tag = ["ok" | "info" | "gray" | "vio" | "warn", string];

const KNOWS: { k: string; t: string; s: string; tag: Tag }[] = [
  { k: "Owns", t: "Sign-in and single sign-on", s: "Staff sign-in, SAML for internal tools", tag: ["ok", "Confirmed"] },
  { k: "Owns", t: "Rate limits", s: "Per-merchant limits on the public API · Aisha Bello", tag: ["ok", "Confirmed"] },
  { k: "Knows", t: "Load-testing new endpoints", s: "From Lena's answers to Payments and Mobile", tag: ["info", "Learned"] },
  { k: "Runs", t: "Deploy pipeline and staging", s: "120 merged PRs in platform/deploy", tag: ["gray", "Seen in GitHub"] },
];

/** The hero's product window: a team's learned picture, a pending confirmation and a sourced answer. */
export function HeroProduct() {
  return (
    <div className="window" role="img" aria-label="Beacon product preview with illustrative data: the Platform team's page showing what Beacon has learned it owns and knows, each with its source, a question asking the team to confirm a new ownership claim, and an answer to another team's question with sources.">
      <div className="window-bar" aria-hidden="true">
        <div className="window-dots"><i /><i /><i /></div>
        <span className="window-title">Beacon · Northwind Labs</span>
        <span className="demo-label">Illustrative demo data</span>
      </div>
      <div className="app" aria-hidden="true">
        <aside className="app-side">
          <div className="org"><span style={{ color: "#17191d" }}><BeaconMark size={18} /></span>Northwind Labs</div>
          <div className="item">Ask Beacon</div>
          <div className="item active">Teams</div>
          <div className="item">Team queue <span className="n">3</span></div>
          <div className="item">My questions</div>
          <div className="sec">Teams</div>
          {[["Platform", "#0e7490"], ["Payments API", "#315efb"], ["Growth", "#c2410c"], ["Sales", "#0f766e"], ["Finance", "#a16207"]].map(([n, c]) => (
            <div key={n} className="item"><span className="sw" style={{ background: c }} />{n}</div>
          ))}
        </aside>
        <div className="app-main">
          <div className="app-head">
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Engineering</div>
              <h4>Platform</h4>
            </div>
            <span className="pill gray" style={{ marginLeft: "auto" }}>GitHub · Slack · Claude Code</span>
          </div>
          <div className="app-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div className="panel">
                <div className="panel-h">What Beacon knows about Platform<span className="muted">Source</span></div>
                <ul className="rows">
                  {KNOWS.map((r) => (
                    <li key={r.t}>
                      <div style={{ minWidth: 0 }}>
                        <div className="t"><span className="muted" style={{ fontWeight: 400 }}>{r.k} · </span>{r.t}</div>
                        <div className="s">{r.s}</div>
                      </div>
                      <span className={`pill ${r.tag[0]}`}>{r.tag[1]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="insight">
                <div className="insight-h">Does Platform own webhook delivery?</div>
                <p>Learned from 3 answers and 4 merged PRs. One teammate&apos;s yes makes it part of Platform&apos;s page.</p>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span className="chip">Yes, we own it</span><span className="chip">No</span><span className="chip">Not sure</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div className="panel">
                <div className="panel-h">Ava asked the Platform agent</div>
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                  <div style={{ color: "#17191d" }}>Can Platform support single sign-on for a merchant admin console?</div>
                  <div>Platform owns single sign-on. <span className="pill ok">Confirmed</span></div>
                  <div>SAML already runs for internal tools. <span className="pill info">Learned</span></div>
                  <div>Merchant identity providers would be new work. <span className="pill vio">Inference</span></div>
                  <div className="muted">Couldn&apos;t find: anything about sign-on for merchants. Sent to Platform&apos;s queue.</div>
                </div>
              </div>
              <div className="ask-bar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#315efb" strokeWidth="2"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
                <span style={{ color: "#17191d" }}>Who owns data exports?</span>
                <kbd>↵</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The showcase's left panel: one team's learned picture, grouped, with sources and freshness. */
export function TeamPicture() {
  const rows: { k: string; t: string; src: string; tag: Tag }[] = [
    { k: "Owns", t: "Sign-in and single sign-on", src: "Confirmed by Marcus · Nov 18", tag: ["ok", "Confirmed"] },
    { k: "Owns", t: "Rate limits, per merchant and per partner", src: "Confirmed by Aisha · Oct 30", tag: ["ok", "Confirmed"] },
    { k: "Knows", t: "How to load-test a new endpoint", src: "Lena's answers to 2 questions · Nov 26", tag: ["info", "Learned"] },
    { k: "Runs", t: "Deploy pipeline and staging", src: "platform/deploy · last merge Dec 5", tag: ["gray", "Seen in GitHub"] },
    { k: "Can help with", t: "Reviewing new services before launch", src: "#platform-asks · Nov 12 · may be out of date", tag: ["info", "Learned"] },
    { k: "How to ask", t: "Ask the agent first; outages go to #platform-oncall", src: "Confirmed by Marcus · Nov 18", tag: ["ok", "Confirmed"] },
  ];
  return (
    <div className="panel">
      <div className="panel-h">What Beacon knows about Platform<span className="demo-label" style={{ marginLeft: "auto" }}>Illustrative</span></div>
      <ul className="rows">
        {rows.map((r) => (
          <li key={r.t}>
            <div style={{ minWidth: 0 }}>
              <div className="t"><span className="muted" style={{ fontWeight: 400 }}>{r.k} · </span>{r.t}</div>
              <div className="s">{r.src}</div>
            </div>
            <span className={`pill ${r.tag[0]}`}>{r.tag[1]}</span>
          </li>
        ))}
      </ul>
      <div className="muted" style={{ padding: "10px 12px", fontSize: 12.5, borderTop: "1px solid var(--line-2)" }}>
        Nobody typed this in. Platform members can confirm, fix or remove any line.
      </div>
    </div>
  );
}

/** "Everyone knows their own team." Silos, the gaps between them, and Beacon's signal paths. */
export function GapVisual() {
  // Each team in its own tools. These are examples of where the work lives, not integrations.
  const silos = [
    { x: 30, y: 18, t: "Product", s: "Roadmaps, specs", tools: ["linear", "figma", "notion"] },
    { x: 300, y: 18, t: "Engineering", s: "Code, tickets", tools: ["github", "jira", "confluence"] },
    { x: 30, y: 246, t: "Sales", s: "CRM, deals", tools: ["hubspot", "zoom", "gmeet"] },
    { x: 300, y: 246, t: "Operations", s: "Processes, budgets", tools: ["zendesk", "gdrive", "notion"] },
  ];
  return (
    <div className="gap-visual">
      <svg viewBox="0 0 470 350" width="100%" role="img" aria-label="Four teams, each in its own tools (Product in Linear, Figma and Notion; Engineering in GitHub, Jira and Confluence; Sales in HubSpot, Zoom and Google Meet; Operations in Zendesk, Google Drive and Notion), with the work between them connected through Beacon.">
        <g stroke="#d6d2c9" strokeWidth="1.5" strokeDasharray="3 5" fill="none">
          <path d="M170 52 L300 52" />
          <path d="M100 104 L100 246" />
          <path d="M370 104 L370 246" />
          <path d="M170 288 L300 288" />
        </g>
        <g fill="#68717e" fontSize="10.5" fontFamily="inherit">
          <text x="182" y="44">&quot;who decided?&quot;</text>
          <text x="20" y="182" transform="rotate(-90 20 182)">&quot;can they help?&quot;</text>
          <text x="455" y="150" transform="rotate(90 455 150)">&quot;is this still true?&quot;</text>
          <text x="186" y="310">&quot;who owns this?&quot;</text>
        </g>
        <g stroke="#315efb" strokeWidth="1.8" fill="none">
          <path d="M140 104 Q180 150 222 168" />
          <path d="M330 104 Q290 150 248 168" />
          <path d="M140 246 Q180 200 222 184" />
          <path d="M330 246 Q290 200 248 184" />
        </g>
        <g>
          <circle cx="235" cy="176" r="30" fill="#172333" />
          <g transform="translate(221 160)" color="#fff" style={{ color: "#fff" }}><BeaconMark size={28} /></g>
        </g>
        {silos.map((s) => (
          <g key={s.t}>
            <rect x={s.x} y={s.y} width="140" height="86" rx="10" fill="#fff" stroke="#e5e3de" />
            <text x={s.x + 14} y={s.y + 26} fontSize="14" fontWeight="600" fill="#17191d">{s.t}</text>
            <text x={s.x + 14} y={s.y + 44} fontSize="11.5" fill="#68717e">{s.s}</text>
            {s.tools.map((id, i) => (
              <SvgMark key={id} id={id} x={s.x + 14 + i * 24} y={s.y + 56} size={16} />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Small diagrams for the three pillars. */
export function PillarGlyph({ kind }: { kind: "context" | "coordinate" | "execute" }) {
  if (kind === "context")
    return (
      <svg viewBox="0 0 220 110" width="88%" aria-hidden="true">
        <g stroke="#d6d2c9" strokeWidth="1.3">
          {[[110, 58, 30, 36], [110, 58, 190, 36], [110, 58, 36, 94], [110, 58, 184, 94], [110, 58, 110, 14], [30, 36, 36, 94], [190, 36, 184, 94]].map(([a, b, c, d], i) => (
            <line key={i} x1={a} y1={b} x2={c} y2={d} />
          ))}
        </g>
        {[["People", 30, 36], ["Decisions", 190, 36], ["Teams", 36, 94], ["Systems", 184, 94], ["Initiatives", 110, 14]].map(([t, x, y]) => (
          <g key={t as string}>
            <circle cx={x as number} cy={y as number} r="5" fill="#fff" stroke="#68717e" strokeWidth="1.5" />
            <text x={(x as number) + (x as number > 110 ? -10 : 10)} y={(y as number) + 4} fontSize="10" fill="#68717e" textAnchor={(x as number) > 110 ? "end" : "start"}>{t}</text>
          </g>
        ))}
        <circle cx="110" cy="58" r="9" fill="#315efb" />
      </svg>
    );
  if (kind === "coordinate")
    return (
      <svg viewBox="0 0 220 110" width="88%" aria-hidden="true">
        {[["Owns sign-on", "#1f8a4c", 16], ["Learned Nov 20", "#315efb", 46], ["Inference", "#6d28d9", 76]].map(([t, c, y]) => (
          <g key={t as string}>
            <rect x="20" y={(y as number) - 2} width="120" height="22" rx="6" fill="#fff" stroke="#dcd9d2" />
            <circle cx="32" cy={(y as number) + 9} r="3.5" fill={c as string} />
            <text x="42" y={(y as number) + 13} fontSize="10" fill="#17191d">{t}</text>
          </g>
        ))}
        <path d="M150 27 H176 V87 H150 M176 57 H196" stroke="#c9c5bc" strokeWidth="1.4" fill="none" />
        <circle cx="200" cy="57" r="5" fill="#315efb" />
      </svg>
    );
  return (
    <svg viewBox="0 0 220 110" width="88%" aria-hidden="true">
      {[["Asked Platform", true], ["In the team queue", true], ["Answered by Ken", false]].map(([t, done], i) => (
        <g key={t as string} transform={`translate(30 ${20 + i * 28})`}>
          <rect width="16" height="16" rx="4" fill={done ? "#315efb" : "#fff"} stroke={done ? "#315efb" : "#c9c5bc"} />
          {done && <path d="M4 8 l3 3 l6 -6" stroke="#fff" strokeWidth="1.8" fill="none" />}
          <text x="26" y="12" fontSize="11" fill="#17191d">{t}</text>
        </g>
      ))}
    </svg>
  );
}

/** The dark final section's backdrop: signal paths converging on one point. */
export function SignalField() {
  const nodes = [[120, 80], [260, 210], [90, 330], [1080, 90], [940, 230], [1110, 340], [330, 60], [870, 60]];
  return (
    <svg className="final-beam" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#2c3c53" strokeWidth="1" fill="none">
        {nodes.map(([x, y], i) => (
          <path key={i} d={`M${x},${y} Q${(x + 600) / 2},${(y + 420) / 2 - 60} 600,420`} />
        ))}
      </g>
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={i % 3 === 0 ? "#d9a45b" : "#4c6488"} />
      ))}
    </svg>
  );
}
