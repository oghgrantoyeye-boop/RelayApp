// Static product mockups for the marketing site. Everything here is illustrative data about a
// fictional company (Northwind Labs) and is labelled as such where it appears.
import { BeaconMark } from "./Brand";

function Av({ n }: { n: string }) {
  return <span className="av" aria-hidden="true">{n.split(" ").map((p) => p[0]).join("")}</span>;
}

const INITIATIVES: { t: string; team: string; color: string; owner: string; due: string; state: ["ok" | "warn" | "bad" | "info", string] }[] = [
  { t: "'Reliable payments' launch", team: "Growth", color: "#c2410c", owner: "Jordan Ellis", due: "Dec 15", state: ["warn", "At risk"] },
  { t: "Webhook retries", team: "Payments API", color: "#315efb", owner: "Priya Raman", due: "Dec 12", state: ["warn", "At risk"] },
  { t: "Per-merchant rate limits", team: "Platform", color: "#0e7490", owner: "Aisha Bello", due: "Dec 9", state: ["bad", "Slipped"] },
  { t: "Enterprise readiness", team: "Sales", color: "#0f766e", owner: "Victor Grant", due: "Jan 11", state: ["info", "Planning"] },
  { t: "Mobile admin SSO", team: "Platform", color: "#0e7490", owner: "Ken Watanabe", due: "Dec 18", state: ["ok", "On track"] },
];

/** The hero's product window: initiatives, the dependency chain, an AI insight and Ask Beacon. */
export function HeroProduct() {
  return (
    <div className="window" role="img" aria-label="Beacon product preview with illustrative data: initiatives with owners and status, a dependency chain from Platform to Sales, an AI insight that the payments launch is at risk, and an Ask Beacon box.">
      <div className="window-bar" aria-hidden="true">
        <div className="window-dots"><i /><i /><i /></div>
        <span className="window-title">Beacon · Northwind Labs</span>
        <span className="demo-label">Illustrative demo data</span>
      </div>
      <div className="app" aria-hidden="true">
        <aside className="app-side">
          <div className="org"><span style={{ color: "#17191d" }}><BeaconMark size={18} /></span>Northwind Labs</div>
          <div className="item active">Operating picture</div>
          <div className="item">Initiatives <span className="n">12</span></div>
          <div className="item">Dependencies <span className="n">3</span></div>
          <div className="item">Commitments</div>
          <div className="item">Ask Beacon</div>
          <div className="sec">Teams</div>
          {[["Platform", "#0e7490"], ["Payments API", "#315efb"], ["Growth", "#c2410c"], ["Sales", "#0f766e"], ["Finance", "#a16207"]].map(([n, c]) => (
            <div key={n} className="item"><span className="sw" style={{ background: c }} />{n}</div>
          ))}
        </aside>
        <div className="app-main">
          <div className="app-head">
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Week of Dec 7</div>
              <h4>Operating picture</h4>
            </div>
            <span className="pill bad" style={{ marginLeft: "auto" }}>1 cross-team blocker</span>
            <span className="pill warn">2 at risk</span>
          </div>
          <div className="app-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div className="panel">
                <div className="panel-h">Initiatives<span className="muted">Owner · due</span></div>
                <ul className="rows">
                  {INITIATIVES.map((r) => (
                    <li key={r.t}>
                      <div style={{ minWidth: 0 }}>
                        <div className="t">{r.t}</div>
                        <div className="s"><span className="sw" style={{ background: r.color, width: 7, height: 7, borderRadius: 2, display: "inline-block" }} />{r.team}<Av n={r.owner} />{r.owner} · {r.due}</div>
                      </div>
                      <span className={`pill ${r.state[0]}`}>{r.state[1]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <div className="panel-h">Dependency chain<span className="muted">Payments launch</span></div>
                <ChainSvg />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div className="insight">
                <div className="insight-h">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
                  Signal: payments launch at risk
                </div>
                <p>Platform&apos;s rate-limit change slipped to Dec 9. Webhook retries (Dec 12) and the Dec 15 launch depend on it. Growth hasn&apos;t been told yet.</p>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span className="chip">PLAT-142</span><span className="chip">Meeting · Dec 4</span><span className="chip">Payments update</span>
                </div>
              </div>
              <div className="panel">
                <div className="panel-h">Needs an owner&apos;s decision</div>
                <ul className="rows">
                  <li><div><div className="t">Confirm new date for rate limits</div><div className="s"><Av n="Aisha Bello" />Aisha Bello · asked by 4 people</div></div><span className="pill info">Routed</span></li>
                  <li><div><div className="t">Move launch email to Dec 17?</div><div className="s"><Av n="Maya Chen" />Maya Chen · due Dec 10</div></div><span className="pill warn">Pending</span></li>
                </ul>
              </div>
              <div className="ask-bar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#315efb" strokeWidth="2"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
                <span style={{ color: "#17191d" }}>What&apos;s blocking the payments launch?</span>
                <kbd>↵</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChainSvg() {
  const steps = [
    { n: "Platform", s: "Rate limits", c: "#c0392b", l: "Slipped" },
    { n: "Payments API", s: "Retries", c: "#b26a00", l: "At risk" },
    { n: "Growth", s: "Launch", c: "#b26a00", l: "At risk" },
    { n: "Sales", s: "Enterprise calls", c: "#68717e", l: "Waiting" },
  ];
  return (
    <svg viewBox="0 0 420 86" width="100%" style={{ display: "block", height: "auto" }}>
      {steps.map((st, i) => {
        const x = 14 + i * 102;
        return (
          <g key={st.n}>
            {i > 0 && <line x1={x - 22} y1="34" x2={x - 4} y2="34" stroke="#cfcac0" strokeWidth="1.5" markerEnd="url(#chain-arrow)" />}
            <rect x={x} y="14" width="80" height="40" rx="8" fill="#fff" stroke="#e5e3de" />
            <text x={x + 9} y="30" fontSize="11" fontWeight="600" fill="#17191d">{st.n}</text>
            <text x={x + 9} y="45" fontSize="10" fill="#68717e">{st.s}</text>
            <circle cx={x + 9} cy="70" r="3.5" fill={st.c} />
            <text x={x + 17} y="73.5" fontSize="10" fill={st.c} fontWeight="500">{st.l}</text>
          </g>
        );
      })}
      <defs>
        <marker id="chain-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cfcac0" /></marker>
      </defs>
    </svg>
  );
}

/** "Your tools are connected. Your organization isn't." Silos, the gaps between them, and Beacon's signal paths. */
export function GapVisual() {
  const silos = [
    { x: 30, y: 30, t: "Product", s: "Roadmaps, specs" },
    { x: 300, y: 30, t: "Engineering", s: "Code, tickets" },
    { x: 30, y: 250, t: "Sales", s: "CRM, deals" },
    { x: 300, y: 250, t: "Operations", s: "Processes, budgets" },
  ];
  return (
    <div className="gap-visual">
      <svg viewBox="0 0 470 350" width="100%" role="img" aria-label="Four teams, each in its own tool, with the work between them connected through Beacon.">
        <g stroke="#d6d2c9" strokeWidth="1.5" strokeDasharray="3 5" fill="none">
          <path d="M170 62 L300 62" />
          <path d="M100 100 L100 250" />
          <path d="M370 100 L370 250" />
          <path d="M170 282 L300 282" />
        </g>
        <g fill="#68717e" fontSize="10.5" fontFamily="inherit">
          <text x="182" y="54">&quot;who decided?&quot;</text>
          <text x="20" y="182" transform="rotate(-90 20 182)">&quot;when will it ship?&quot;</text>
          <text x="455" y="150" transform="rotate(90 455 150)">&quot;what changed?&quot;</text>
          <text x="186" y="304">&quot;who owns this?&quot;</text>
        </g>
        <g stroke="#315efb" strokeWidth="1.8" fill="none">
          <path d="M140 100 Q180 150 222 168" />
          <path d="M330 100 Q290 150 248 168" />
          <path d="M140 250 Q180 200 222 184" />
          <path d="M330 250 Q290 200 248 184" />
        </g>
        <g>
          <circle cx="235" cy="176" r="30" fill="#172333" />
          <g transform="translate(221 160)" color="#fff" style={{ color: "#fff" }}><BeaconMark size={28} /></g>
        </g>
        {silos.map((s) => (
          <g key={s.t}>
            <rect x={s.x} y={s.y} width="140" height="70" rx="10" fill="#fff" stroke="#e5e3de" />
            <text x={s.x + 14} y={s.y + 30} fontSize="14" fontWeight="600" fill="#17191d">{s.t}</text>
            <text x={s.x + 14} y={s.y + 50} fontSize="11.5" fill="#68717e">{s.s}</text>
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
        {[["Design", 14, 18], ["Engineering", 80, 46], ["Product", 150, 74]].map(([t, x, y], i) => (
          <g key={t as string}>
            <rect x={x as number} y={y as number} width="62" height="24" rx="6" fill="#fff" stroke={i === 1 ? "#c0392b" : "#dcd9d2"} />
            <text x={(x as number) + 8} y={(y as number) + 16} fontSize="10" fill="#17191d">{t}</text>
          </g>
        ))}
        <path d="M45 42 Q52 58 80 58" stroke="#1f8a4c" strokeWidth="1.6" fill="none" />
        <path d="M142 58 Q170 60 178 74" stroke="#c0392b" strokeWidth="1.6" strokeDasharray="4 4" fill="none" />
        <circle cx="162" cy="62" r="4" fill="#fff" stroke="#c0392b" strokeWidth="1.6" />
      </svg>
    );
  return (
    <svg viewBox="0 0 220 110" width="88%" aria-hidden="true">
      {[["Decision approved", true], ["Owners notified", true], ["Commitment tracked", false]].map(([t, done], i) => (
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
