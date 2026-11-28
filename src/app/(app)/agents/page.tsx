import { workersEnabled } from "@/lib/flags";
import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { listAgents, TIER_LABEL } from "@/lib/agents";
import { Avatar, Pill, Topbar } from "@/components/ui";

export default async function AgentsPage() {
  const { db, viewer } = await currentViewer();
  const agents = await listAgents(db, viewer.orgId);
  const teams = [...new Map(agents.map((a) => [a.team.id, a.team])).values()];
  const mineFirst = teams.sort((a, b) => Number(viewer.reader.unitIds.includes(b.id)) - Number(viewer.reader.unitIds.includes(a.id)));

  return (
    <>
      <Topbar crumbs={["Agents"]}>
        {workersEnabled() && (<div className="actions"><Link href="/agents/new" className="b bp sm">+ New teammate</Link></div>)}
      </Topbar>
      <div className="content">
        <div className="page-head">
          <h1>Agent teammates</h1>
          <p>Agents work alongside people. Every team has a built-in agent that answers for it. Teams add more: <b>Q&amp;A</b> agents that answer and route, and <b>Workers</b> that do jobs in a sandbox, like research, document review or code changes. Message any of them, or @mention one in the agent panel.</p>
        </div>
        {mineFirst.map((t) => (
          <section key={t.id}>
            <h2><span className="swatch" style={{ background: t.color, marginRight: 6 }} />{t.name}{viewer.reader.unitIds.includes(t.id) && <span className="small muted" style={{ fontWeight: 400 }}> · your team</span>}</h2>
            <div className="agent-grid">
              {agents.filter((a) => a.team.id === t.id).map((a) => (
                <div key={a.id} className="card agent-card">
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={a.name} agent size={36} />
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{a.name}</div>
                      <div className="row" style={{ gap: 6 }}>
                        <Pill tone={a.tier === "worker" ? "violet" : "gray"} dot={false}>{TIER_LABEL[a.tier]}</Pill>
                        <span className="small muted">{a.builtIn ? "Built in" : `Added by ${a.createdBy ?? "the team"}`}</span>
                      </div>
                    </div>
                  </div>
                  <p className="small muted" style={{ margin: "8px 0" }}>{a.purpose}</p>
                  <div className="row" style={{ gap: 6 }}>
                    <Link className="b sm bp" href={`/messages?with=${a.id}`}>Message</Link>
                    <Link className="b sm" href={`/agents/${a.team.slug}${a.builtIn ? "" : `?agent=${a.id}`}`}>Profile</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
