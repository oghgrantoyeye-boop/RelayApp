"use client";
import { useMemo, useState } from "react";

type State = "ok" | "warn" | "bad";
const STATE: Record<State, { label: string; color: string; dash?: string }> = {
  ok: { label: "On track", color: "#1f8a4c" },
  warn: { label: "At risk", color: "#b26a00" },
  bad: { label: "Blocked", color: "#c0392b", dash: "5 5" },
};

// Illustrative data for a fictional company. Each edge: the provider team owes the dependent team something.
const NODES = [
  { id: "product", name: "Product", owner: "Ava Thompson", x: 320, y: 62 },
  { id: "engineering", name: "Engineering", owner: "Daniel Brooks", x: 122, y: 178, blockers: 1 },
  { id: "sales", name: "Sales", owner: "Victor Grant", x: 518, y: 178 },
  { id: "design", name: "Design", owner: "Nora Kim", x: 110, y: 322 },
  { id: "operations", name: "Operations", owner: "Henry Adams", x: 320, y: 322 },
  { id: "finance", name: "Finance", owner: "Isabel Moreno", x: 530, y: 322 },
] as const;
type NodeId = (typeof NODES)[number]["id"];

const EDGES: { from: NodeId; to: NodeId; what: string; owner: string; due: string; state: State; bend: number }[] = [
  { from: "engineering", to: "product", what: "Webhook retries live in production", owner: "Priya Raman", due: "Dec 12", state: "warn", bend: -40 },
  { from: "product", to: "sales", what: "Confirmed launch date for enterprise calls", owner: "Ava Thompson", due: "Dec 8", state: "warn", bend: -40 },
  { from: "design", to: "engineering", what: "Retry status screens", owner: "Iris Novak", due: "Dec 2", state: "ok", bend: 30 },
  { from: "operations", to: "finance", what: "Final headcount plan for Q1 budgets", owner: "Henry Adams", due: "Dec 3", state: "bad", bend: 26 },
  { from: "finance", to: "sales", what: "Approvals for discounts over 20%", owner: "Isabel Moreno", due: "Ongoing", state: "ok", bend: 30 },
  { from: "engineering", to: "operations", what: "Old scheduler retired", owner: "Lena Fischer", due: "Dec 18", state: "ok", bend: 24 },
  { from: "sales", to: "product", what: "Enterprise customer requirements", owner: "Victor Grant", due: "Dec 10", state: "ok", bend: -40 },
];

const W = 124;
const H = 46;

function pathFor(e: (typeof EDGES)[number]) {
  const a = NODES.find((n) => n.id === e.from)!;
  const b = NODES.find((n) => n.id === e.to)!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Start and end at the node boxes' edges, not their centres.
  const clip = (nx: number, ny: number) => {
    const tx = Math.abs(nx) > 1e-6 ? (W / 2 + 6) / Math.abs(nx) : Infinity;
    const ty = Math.abs(ny) > 1e-6 ? (H / 2 + 6) / Math.abs(ny) : Infinity;
    return Math.min(tx, ty);
  };
  const ux = dx / len;
  const uy = dy / len;
  const s = clip(ux, uy);
  const x1 = a.x + ux * s;
  const y1 = a.y + uy * s;
  const x2 = b.x - ux * s;
  const y2 = b.y - uy * s;
  const mx = (x1 + x2) / 2 - uy * e.bend;
  const my = (y1 + y2) / 2 + ux * e.bend;
  return { d: `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`, mid: { x: (x1 + 2 * mx + x2) / 4, y: (y1 + 2 * my + y2) / 4 } };
}

export function DependencyGraph() {
  const [focus, setFocus] = useState<NodeId | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const paths = useMemo(() => EDGES.map(pathFor), []);
  const related = (e: (typeof EDGES)[number]) => !focus || e.from === focus || e.to === focus;
  const nodeOn = (id: NodeId) => !focus || id === focus || EDGES.some((e) => related(e) && (e.from === id || e.to === id));
  const name = (id: NodeId) => NODES.find((n) => n.id === id)!.name;
  const list = EDGES.filter(related);

  return (
    <div className="panel">
      <div className="panel-h">
        Cross-team dependencies
        <span className="muted">{focus ? <button className="linkish" onClick={() => setFocus(null)}>Show all teams</button> : "Select a team to focus"}</span>
      </div>
      <div className="graph-wrap">
        <svg className="graph-svg" viewBox="0 0 640 384" role="img" aria-label="Dependency graph between Product, Engineering, Design, Finance, Sales and Operations. The list below describes each dependency.">
          <defs>
            {(Object.keys(STATE) as State[]).map((s) => (
              <marker key={s} id={`arrow-${s}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={STATE[s].color} />
              </marker>
            ))}
          </defs>
          {EDGES.map((e, i) => (
            <g key={i} className={related(e) ? "" : "dim"}>
              <path className="edge" d={paths[i].d} stroke={STATE[e.state].color} strokeWidth={tip?.i === i ? 3 : 2} strokeDasharray={STATE[e.state].dash} markerEnd={`url(#arrow-${e.state})`} />
              <path
                className="hit"
                d={paths[i].d}
                onMouseEnter={() => setTip({ x: paths[i].mid.x, y: paths[i].mid.y, i })}
                onMouseLeave={() => setTip(null)}
              />
              {e.state !== "ok" && <circle cx={paths[i].mid.x} cy={paths[i].mid.y} r="4.5" fill="#fff" stroke={STATE[e.state].color} strokeWidth="2" pointerEvents="none" />}
            </g>
          ))}
          {NODES.map((n) => (
            <g
              key={n.id}
              className={`node${nodeOn(n.id) ? "" : " dim"}`}
              transform={`translate(${n.x - W / 2},${n.y - H / 2})`}
              role="button"
              tabIndex={0}
              aria-pressed={focus === n.id}
              aria-label={`${n.name}, owner ${n.owner}. Focus its dependencies.`}
              onClick={() => setFocus(focus === n.id ? null : n.id)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setFocus(focus === n.id ? null : n.id);
                }
              }}
            >
              <rect width={W} height={H} rx="10" fill={focus === n.id ? "#eef2ff" : "#fff"} stroke={focus === n.id ? "#315efb" : "#dcd9d2"} strokeWidth="1.5" />
              <text x="12" y="19" fontSize="13" fontWeight="600" fill="#17191d">{n.name}</text>
              <text x="12" y="35" fontSize="10.5" fill="#68717e">{n.owner}</text>
              {"blockers" in n && n.blockers ? (
                <g transform={`translate(${W - 22},-8)`}>
                  <circle r="9" cx="9" cy="9" fill="#c0392b" />
                  <text x="9" y="13" fontSize="10.5" fontWeight="700" fill="#fff" textAnchor="middle">{n.blockers}</text>
                </g>
              ) : null}
            </g>
          ))}
        </svg>
        {tip && (
          <div className="graph-tip" style={{ left: `${(tip.x / 640) * 100}%`, top: `${(tip.y / 384) * 100}%` }}>
            <b>{name(EDGES[tip.i].from)} → {name(EDGES[tip.i].to)}</b>
            <br />
            {EDGES[tip.i].what}
            <br />
            Owner {EDGES[tip.i].owner} · due {EDGES[tip.i].due} · {STATE[EDGES[tip.i].state].label}
          </div>
        )}
      </div>
      <div className="legend" aria-hidden="true">
        {(Object.keys(STATE) as State[]).map((s) => (
          <span key={s}><i style={{ borderColor: STATE[s].color, borderTopStyle: STATE[s].dash ? "dashed" : "solid" }} />{STATE[s].label}</span>
        ))}
        <span><b style={{ display: "inline-flex", width: 14, height: 14, borderRadius: 7, background: "#c0392b", color: "#fff", fontSize: 9, alignItems: "center", justifyContent: "center" }}>1</b> Blocker inside the team</span>
      </div>
      <ul className="graph-list" aria-label="Dependencies">
        {list.map((e, i) => (
          <li key={i}>
            <b style={{ fontWeight: 600 }}>{name(e.from)}</b> owes <b style={{ fontWeight: 600 }}>{name(e.to)}</b>: {e.what} ({e.owner}, {e.due}) ·{" "}
            <span style={{ color: STATE[e.state].color, fontWeight: 500 }}>{STATE[e.state].label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
