import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { AGENT_ACTIONS, APPROVAL, SCHEDULE, galleryFor, teamsFor, tierOf } from "@/lib/agents";
import { teamConnectors, CONNECTOR_LABEL } from "@/lib/integrations";
import { createAgentAction } from "@/app/actions";
import { Avatar, Flash, Pill, Topbar } from "@/components/ui";

export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ template?: string; team?: string; msg?: string }> }) {
  const sp = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const teams = teamsFor(viewer);
  const gallery = galleryFor(demo);
  const onDemoTeam = teams.some((t) => t.id === demo.agentTemplate.team);
  const tpl = gallery.find((g) => g.id === sp.template) ?? (onDemoTeam ? gallery[0] : gallery[1]);
  const team = teams.find((t) => t.id === sp.team) ?? teams.find((t) => tpl.id === "demo" && t.id === demo.agentTemplate.team) ?? teams[0];
  const tools = team ? await teamConnectors(db, team.id) : [];
  const q = (o: Record<string, string>) => `/agents/new?${new URLSearchParams({ template: tpl.id, ...(team ? { team: team.id } : {}), ...o })}`;

  return (
    <>
      <Topbar crumbs={[{ href: "/agents", label: "Agents" }, "New teammate"]} />
      <div className="content">
        <Flash msg={sp.msg} />
        <div className="page-head">
          <h1>Add an agent teammate</h1>
          <p>Start from a ready-made teammate or build your own. It joins one team, reads only what that team may read, works in its own sandbox, and asks a person before anything leaves the team.</p>
        </div>

        <h2>1. Pick a starting point</h2>
        <div className="gallery">
          {gallery.map((g) => {
            const tier = tierOf(g.actions);
            return (
              <Link key={g.id} href={q({ template: g.id })} className="gallery-card" aria-current={g.id === tpl.id ? "true" : undefined}>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar name={`${g.name} agent`} agent size={28} />
                  <span style={{ fontWeight: 600 }}>{g.name}</span>
                </div>
                <div className="row" style={{ gap: 6, margin: "6px 0" }}>
                  <Pill tone={tier === "worker" ? "violet" : "gray"} dot={false}>{tier === "worker" ? "Worker" : "Q&A"}</Pill>
                  <span className="small muted">{g.by === "beacon" ? "Provided by Beacon" : `Made for ${demo.org.short}`}</span>
                </div>
                <p className="small muted" style={{ margin: 0 }}>{g.purpose}</p>
              </Link>
            );
          })}
          <Link href={q({ template: "custom" })} className="gallery-card dashed" aria-current={sp.template === "custom" ? "true" : undefined}>
            <span style={{ fontWeight: 600 }}>Build your own</span>
            <p className="small muted" style={{ margin: "6px 0 0" }}>Name it, write its job in plain words and choose exactly what it can read and do.</p>
          </Link>
        </div>

        {teams.length === 0 ? (
          <div className="card">You aren&apos;t on a team that can add agents.</div>
        ) : (
          <div className="two" style={{ marginTop: 18 }}>
            <form action={createAgentAction} className="primary card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h2 style={{ margin: 0 }}>2. Set it up</h2>
              <div className="field">
                <span>Team</span>
                <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                  {teams.map((t) => (
                    <Link key={t.id} href={q({ team: t.id })} className={`chip${t.id === team!.id ? " on" : ""}`}>{t.name}</Link>
                  ))}
                </div>
                <input type="hidden" name="unitId" value={team!.id} />
              </div>
              <label className="field">
                <span>Name</span>
                <input name="name" required defaultValue={sp.template === "custom" ? "" : tpl.name} placeholder="For example: Contract reviewer" />
              </label>
              <label className="field">
                <span>Its job, in plain words</span>
                <textarea name="purpose" rows={3} required defaultValue={sp.template === "custom" ? "" : tpl.purpose} placeholder="What should it do, for whom, and when?" />
              </label>

              <fieldset className="field">
                <legend>What it can read</legend>
                <p className="small muted" style={{ margin: "0 0 6px" }}>Only tools {team!.name} connected. It also reads what other teams published, at {team!.name}&apos;s level, and never marked work the team isn&apos;t cleared for.</p>
                {tools.length === 0 && <p className="small">No tools connected yet. <Link href="/connect" style={{ color: "var(--blue)" }}>Connect some</Link>.</p>}
                {tools.map((c) => (
                  <label key={c.id} className="check"><input type="checkbox" name="connectors" value={c.id} defaultChecked /> {String(c.name).startsWith(CONNECTOR_LABEL[c.kind] ?? c.kind) ? c.name : `${CONNECTOR_LABEL[c.kind] ?? c.kind}: ${c.name}`}</label>
                ))}
              </fieldset>

              <fieldset className="field">
                <legend>What it can do</legend>
                {(["qa", "worker"] as const).map((tier) => (
                  <div key={tier} style={{ marginBottom: 6 }}>
                    <div className="small muted" style={{ margin: "4px 0" }}>{tier === "qa" ? "Q&A: reads and answers" : "Worker: does jobs in its sandbox"}</div>
                    {AGENT_ACTIONS.filter((a) => a.tier === tier).map((a) => (
                      <label key={a.id} className="check" style={{ alignItems: "flex-start" }}>
                        <input type="checkbox" name="actions" value={a.id} defaultChecked={sp.template !== "custom" && tpl.actions.includes(a.id)} />
                        <span><span style={{ fontWeight: 500 }}>{a.label}</span><span className="small muted" style={{ display: "block" }}>{a.detail}</span></span>
                      </label>
                    ))}
                  </div>
                ))}
              </fieldset>

              <fieldset className="field">
                <legend>Approvals</legend>
                {Object.entries(APPROVAL).map(([k, label]) => (
                  <label key={k} className="check"><input type="radio" name="approval" value={k} defaultChecked={k === "outside_team"} /> {label}</label>
                ))}
                <p className="small muted" style={{ margin: "4px 0 0" }}>Either way, it can&apos;t publish, confirm a commitment, merge code or send anything outside {demo.org.short} on its own.</p>
              </fieldset>

              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>Runs</span>
                  <select name="schedule" defaultValue={tpl.schedule}>
                    {Object.entries(SCHEDULE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="field" style={{ width: 160 }}>
                  <span>Monthly budget ($)</span>
                  <input name="budget" type="number" min={1} max={500} defaultValue={50} />
                </label>
              </div>
              <div className="row">
                <span className="small muted">Everyone on {team!.name} can message it, give it work and see what it does.</span>
                <button className="b bp" type="submit" style={{ marginLeft: "auto" }}>Add to {team!.name}</button>
              </div>
            </form>
            <aside>
              <section>
                <h2>How it stays safe</h2>
                <ul className="small" style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6 }}>
                  <li><b>Its own sandbox.</b> Each job runs in an isolated container with only the tools you picked. Coding jobs get a fresh copy of the repository.</li>
                  <li><b>Your team&apos;s access, never more.</b> When it works for someone, it sees only what that person may see.</li>
                  <li><b>People sign off.</b> Drafts, pull requests and document changes wait for a person.</li>
                  <li><b>A budget.</b> It stops when the monthly budget runs out.</li>
                  <li><b>Everything is logged.</b> Every read and action is in the <Link href="/audit" style={{ color: "var(--blue)" }}>audit log</Link>.</li>
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
