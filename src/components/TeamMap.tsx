"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export interface MapNode {
  id: string;
  name: string;
  slug: string;
  color: string;
  lead: string | null;
  people: number;
  x: number;
  y: number;
}
export type CState = "on_track" | "at_risk" | "slipped";
export interface MapEdge {
  type: "commitment" | "ask" | "share";
  from: string;
  to: string;
  count: number;
  state?: CState;
  level?: string;
  cadence?: string;
  items: string[];
}

const STATE: Record<CState, { label: string; color: string }> = {
  on_track: { label: "On track", color: "#16a34a" },
  at_risk: { label: "At risk", color: "#d97706" },
  slipped: { label: "Slipped", color: "#dc2626" },
};
const ASK = "#7c3aed";
const SHARE = "#a1a1aa";
const W = 156;
const H = 52;
const VB = { w: 1000, h: 480 };

function geometry(a: MapNode, b: MapNode, bend: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tx = Math.abs(ux) > 1e-6 ? (W / 2 + 6) / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? (H / 2 + 6) / Math.abs(uy) : Infinity;
  const s = Math.min(tx, ty);
  const x1 = a.x + ux * s;
  const y1 = a.y + uy * s;
  const x2 = b.x - ux * s;
  const y2 = b.y - uy * s;
  const cx = (x1 + x2) / 2 - uy * bend;
  const cy = (y1 + y2) / 2 + ux * bend;
  return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, mx: (x1 + 2 * cx + x2) / 4, my: (y1 + 2 * cy + y2) / 4 };
}

export function TeamMap({ nodes, edges, viewerTeam }: { nodes: MapNode[]; edges: MapEdge[]; viewerTeam: string }) {
  const [layers, setLayers] = useState({ commitment: true, ask: true, share: false, leadership: false });
  const [focus, setFocus] = useState<string | null>(viewerTeam);
  const [tip, setTip] = useState<{ e: MapEdge; x: number; y: number } | null>(null);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const shown = edges.filter(
    (e) => layers[e.type] && (layers.leadership || (e.from !== "leadership" && e.to !== "leadership")) && byId.has(e.from) && byId.has(e.to),
  );
  const touches = (e: MapEdge) => !focus || e.from === focus || e.to === focus;
  const nodeOn = (id: string) => !focus || id === focus || shown.some((e) => touches(e) && (e.from === id || e.to === id));
  const bend = (e: MapEdge) => (e.type === "commitment" ? 34 : e.type === "ask" ? -34 : 0);
  const name = (id: string) => byId.get(id)?.name ?? id;
  const describe = (e: MapEdge) =>
    e.type === "commitment"
      ? `${name(e.from)} owes ${name(e.to)} ${e.count} ${e.count === 1 ? "commitment" : "commitments"}${e.state ? ` (${STATE[e.state].label.toLowerCase()})` : ""}`
      : e.type === "ask"
        ? `${name(e.from)} has ${e.count} open ${e.count === 1 ? "ask" : "asks"} with ${name(e.to)}`
        : `${name(e.from)} shares with ${name(e.to)} at ${e.level}, ${e.cadence}`;
  const toggle = (k: keyof typeof layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const focused = focus ? byId.get(focus) : null;

  return (
    <div className="two">
      <div className="primary">
        <div className="row" role="group" aria-label="Layers">
          {([
            ["commitment", "Commitments"],
            ["ask", "Open asks"],
            ["share", "What teams share"],
            ["leadership", "Include Leadership"],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" className="b chipb" aria-pressed={layers[k]} onClick={() => toggle(k)}>{label}</button>
          ))}
          {focus && <button type="button" className="b chipb" onClick={() => setFocus(null)} style={{ marginLeft: "auto" }}>Show all teams</button>}
        </div>
        <div className="card tight" style={{ position: "relative" }}>
          <svg viewBox={layers.leadership ? `0 0 ${VB.w} ${VB.h}` : `0 150 ${VB.w} ${VB.h - 150}`} width="100%" role="img" aria-label="Map of teams and how they depend on each other. The table below lists every relationship." style={{ display: "block" }}>
            <defs>
              {[["c-on_track", STATE.on_track.color], ["c-at_risk", STATE.at_risk.color], ["c-slipped", STATE.slipped.color], ["ask", ASK], ["share", SHARE]].map(([id, c]) => (
                <marker key={id} id={`m-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c} />
                </marker>
              ))}
            </defs>
            {shown.map((e, i) => {
              const a = byId.get(e.from)!;
              const b = byId.get(e.to)!;
              const g = geometry(a, b, bend(e));
              const color = e.type === "commitment" ? STATE[e.state ?? "on_track"].color : e.type === "ask" ? ASK : SHARE;
              const marker = e.type === "commitment" ? `c-${e.state ?? "on_track"}` : e.type;
              const width = e.type === "share" ? (e.level === "full" ? 3 : e.level === "summary" ? 2 : 1.2) : 2.4;
              const dash = e.type === "ask" ? "5 4" : e.type === "share" && e.cadence !== "immediate" ? "2 4" : undefined;
              return (
                <g key={i} opacity={touches(e) ? 1 : 0.12} style={{ transition: "opacity .2s" }}>
                  <path d={g.d} fill="none" stroke={color} strokeWidth={tip?.e === e ? width + 1.2 : width} strokeDasharray={dash} markerEnd={`url(#m-${marker})`} strokeLinecap="round" />
                  <path d={g.d} fill="none" stroke="transparent" strokeWidth="16" style={{ cursor: "pointer" }}
                    onMouseEnter={() => setTip({ e, x: g.mx, y: g.my })} onMouseLeave={() => setTip(null)} />
                  {e.type !== "share" && (
                    <g pointerEvents="none">
                      <circle cx={g.mx} cy={g.my} r="10" fill="#fff" stroke={color} strokeWidth="2" />
                      <text x={g.mx} y={g.my + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#18181b">{e.count}</text>
                    </g>
                  )}
                </g>
              );
            })}
            {nodes.filter((n) => layers.leadership || n.id !== "leadership").map((n) => (
              <g key={n.id} transform={`translate(${n.x - W / 2},${n.y - H / 2})`} role="button" tabIndex={0} aria-pressed={focus === n.id}
                aria-label={`${n.name}. Focus its relationships.`} style={{ cursor: "pointer", opacity: nodeOn(n.id) ? 1 : 0.25, transition: "opacity .2s" }}
                onClick={() => setFocus(focus === n.id ? null : n.id)}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setFocus(focus === n.id ? null : n.id); } }}>
                <rect width={W} height={H} rx="10" fill={focus === n.id ? "#eff6ff" : "#fff"} stroke={focus === n.id ? "#1d4ed8" : "#d4d4d8"} strokeWidth="1.5" />
                <rect x="12" y="15" width="9" height="9" rx="2" fill={n.color} />
                <text x="28" y="23" fontSize="13" fontWeight="600" fill="#18181b">{n.name}{n.id === viewerTeam ? " (you)" : ""}</text>
                <text x="12" y="41" fontSize="11" fill="#5f5f6b">{n.lead ?? ""} · {n.people} people</text>
              </g>
            ))}
          </svg>
          {tip && (
            <div style={{ position: "absolute", left: `${(tip.x / VB.w) * 100}%`, top: `${layers.leadership ? (tip.y / VB.h) * 100 : ((tip.y - 150) / (VB.h - 150)) * 100}%`, transform: "translate(-50%, calc(-100% - 14px))", background: "#18181b", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 12, maxWidth: 280, pointerEvents: "none", zIndex: 2 }}>
              <strong>{describe(tip.e)}</strong>
              {tip.e.items.slice(0, 4).map((t, i) => <div key={i} style={{ marginTop: 3 }}>{t}</div>)}
            </div>
          )}
          <div className="row small muted" style={{ padding: "10px 12px", borderTop: "1px solid var(--line-2)", gap: 14 }} aria-hidden="true">
            {(Object.keys(STATE) as CState[]).map((s) => (
              <span key={s} className="row" style={{ gap: 6 }}><i style={{ width: 18, borderTop: `2.4px solid ${STATE[s].color}`, display: "inline-block" }} />Commitment {STATE[s].label.toLowerCase()}</span>
            ))}
            <span className="row" style={{ gap: 6 }}><i style={{ width: 18, borderTop: `2px dashed ${ASK}`, display: "inline-block" }} />Open asks</span>
            <span className="row" style={{ gap: 6 }}><i style={{ width: 18, borderTop: `2px solid ${SHARE}`, display: "inline-block" }} />Shares (thicker = more detail)</span>
            <span>Numbers count items. Arrows point to the team waiting or asked.</span>
          </div>
        </div>
        <section>
          <h2>{focused ? `${focused.name}'s relationships` : "All relationships"}</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Relationship</th><th>Details at your level</th></tr></thead>
              <tbody>
                {shown.filter(touches).map((e, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {e.type === "commitment" && e.state && <span className="pill" style={{ marginRight: 8, color: STATE[e.state].color, borderColor: "currentColor", background: "#fff" }}>{STATE[e.state].label}</span>}
                      {describe(e)}
                    </td>
                    <td className="small">{e.items.length ? e.items.slice(0, 5).join(" · ") : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside>
        <section>
          <h2>Teams</h2>
          <ul className="list">
            {nodes.map((n) => (
              <li key={n.id} style={{ padding: "5px 0", border: 0 }}>
                <span className="swatch" style={{ background: n.color, marginTop: 5 }} />
                <div className="grow">
                  <button type="button" onClick={() => setFocus(n.id)} style={{ all: "unset", cursor: "pointer", fontWeight: focus === n.id ? 600 : 400 }}>{n.name}</button>
                  <div className="small muted">{n.lead}</div>
                </div>
                <Link href={`/teams/${n.slug}`} className="small" style={{ color: "var(--blue)" }}>Page</Link>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
