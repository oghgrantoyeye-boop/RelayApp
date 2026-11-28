import { workersEnabled } from "@/lib/flags";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentViewer } from "@/lib/session";
import { listTasks, fmtCost, TASK_KIND_LABEL } from "@/lib/work";
import { agentStats } from "@/lib/agent";
import { teamConnectors, CONNECTOR_LABEL } from "@/lib/integrations";
import { getLLM } from "@/lib/ai/llm";
import { fmtDateTime } from "@/lib/clock";
import { Flash, Icon, Pill, Topbar } from "@/components/ui";
import { TASK_STATUS } from "@/components/taskStatus";
import { startTaskAction } from "@/app/actions";
import { AGENT_ACTIONS, APPROVAL, SCHEDULE, TIER_LABEL, getAgent, listAgents } from "@/lib/agents";
import { Avatar } from "@/components/ui";

// Server actions on this page start agent work that keeps running after the response.
export const maxDuration = 300;


export default async function AgentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ msg?: string; agent?: string }> }) {
  const workers = workersEnabled();
  const { slug } = await params;
  const { msg, agent: agentParam } = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const team = await db.one(`select * from unit where slug = $1 and org_id = $2 and how_to_ask <> '{}'::jsonb`, [slug, viewer.orgId]);
  if (!team) notFound();
  const agent = await db.one(`select a.* from app_user a join member m on m.user_id = a.id where m.unit_id = $1 and a.kind = 'agent' and a.id = 'agent_' || $1`, [team.id]);
  if (!agent) notFound();
  // A teammate the team added, or the team's built-in agent.
  const teamAgents = (await listAgents(db, viewer.orgId)).filter((a) => a.team.id === team.id);
  const profile = (agentParam ? teamAgents.find((a) => a.id === agentParam) : null) ?? (await getAgent(db, agent.id, viewer.orgId));
  if (!profile) notFound();
  const custom = !profile.builtIn;
  const shown = custom ? await db.one(`select * from app_user where id = $1`, [profile.id]) : agent;
  if (!shown) notFound();
  const can = (a: string) => profile.actions.includes(a);
  const kinds = [
    can("research") && { id: "research", label: "Research with me" },
    can("draft_update") && { id: "draft_update", label: "Draft our weekly update from our tools" },
    can("documents") && { id: "review_doc", label: "Review a document" },
    can("code") && { id: "code", label: "Change code" },
  ].filter(Boolean) as { id: string; label: string }[];
  const lead = await db.one(`select a.name from member m join app_user a on a.id = m.user_id where m.unit_id = $1 and m.role = 'lead'`, [team.id]);
  const isMember = viewer.reader.unitIds.includes(team.id);
  const tasks = await listTasks(db, viewer, team.id);
  const tools = await teamConnectors(db, team.id);
  const stats = await agentStats(db, team.id);
  const counts = (await db.one(
    `select (select count(*)::int from update_item where unit_id = $1 and status = 'published') as items,
            (select count(*)::int from source_doc where unit_id = $1) as docs,
            (select count(*)::int from meeting where unit_id = $1) as meetings`,
    [team.id],
  ))!;
  const questions = isMember
    ? await db.query(
        `select q.*, a.name as asker_name, u.name as asker_team from question q join app_user a on a.id = q.asker_id
         left join member m on m.user_id = a.id left join unit u on u.id = m.unit_id and u.how_to_ask <> '{}'::jsonb
         where q.unit_id = $1 and u.id is not null order by q.created_at desc limit 8`,
        [team.id],
      )
    : [];
  const spent = Number(shown.spent_usd);
  const budget = Number(shown.monthly_budget_usd ?? 0);
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const hasModel = !!getLLM().research;

  return (
    <>
      <Topbar crumbs={[{ href: "/agents", label: "Agents" }, { href: `/teams/${team.slug}`, label: team.name }, profile.name]}>
        <div className="actions"><Link className="b sm bp" href={`/messages?with=${profile.id}`}>Message</Link></div>
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div className="row" style={{ gap: 12 }}>
            <Avatar name={profile.name} agent size={44} />
            <div>
              <h1>{profile.name} <Pill tone={profile.tier === "worker" ? "violet" : "gray"} dot={false}>{TIER_LABEL[profile.tier]}</Pill></h1>
              <p>{custom ? `A teammate on ${team.name}, added by ${profile.createdBy ?? "the team"}. ` : `${team.name}'s built-in agent. `}{profile.purpose}{workers ? " People approve anything that leaves the team." : " It answers questions and sends the rest to the right person."}</p>
            </div>
          </div>
        </div>

        <div className="two">
          <div className="primary">
            {workers && (isMember ? (
              <section className="card">
                <div className="row"><span className="ai-head"><Icon name="agent" size={14} />Give the agent work</span></div>
                <p className="small muted" style={{ marginTop: 4 }}>Every task is visible to all of {team.name}. Anyone on the team can comment, redirect it or take it over.</p>
                <form action={startTaskAction} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="hidden" name="unitId" value={team.id} />
                  <input type="hidden" name="slug" value={team.slug} />
                  {custom && <input type="hidden" name="agentId" value={profile.id} />}
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    {kinds.map((k, i) => (
                      <label key={k.id} className="check"><input type="radio" name="kind" value={k.id} defaultChecked={i === 0} /> {k.label}</label>
                    ))}
                  </div>
                  <textarea name="instructions" rows={3} placeholder={can("documents") ? "Which document, and what should it check? For example: review the latest draft" : can("code") ? "What should it change? For example: fix the flaky load test" : `For research: what should it find out? For example: ${demo.ui.researchHint}`} aria-label="Instructions" />
                  <div className="row">
                    {!hasModel && <span className="small" style={{ color: "#92400e" }}>Research needs ANTHROPIC_API_KEY. Drafting updates works without it.</span>}
                    <button className="b bp" type="submit" style={{ marginLeft: "auto" }}>Start</button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="card">
                <p>Only {team.name} can give its agent work. You can ask it questions on <Link href={`/teams/${team.slug}#agent`} style={{ color: "var(--blue)" }}>{team.name}&apos;s page</Link>; it answers at your level of access.</p>
              </section>
            ))}

            {workers && isMember && (
              <section>
                <h2>Task runs</h2>
                {tasks.length === 0 ? (
                  <div className="card empty">No tasks yet.</div>
                ) : (
                  <div className="tablewrap">
                    <table>
                      <thead><tr><th>Task</th><th>Asked by</th><th>Status</th><th>Cost</th><th>Updated (UTC)</th></tr></thead>
                      <tbody>
                        {tasks.map((t) => {
                          const [tone, label] = TASK_STATUS[t.status] ?? ["gray", t.status];
                          return (
                            <tr key={t.id}>
                              <td><Link href={`/agents/${team.slug}/tasks/${t.id}`} style={{ fontWeight: 500 }}>{t.title}</Link><div className="small muted">{TASK_KIND_LABEL[t.kind] ?? t.kind}</div></td>
                              <td>{t.requester_name}</td>
                              <td><Pill tone={tone}>{label}</Pill></td>
                              <td className="mono">{fmtCost(t.cost_usd)}</td>
                              <td className="mono">{fmtDateTime(t.updated_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {isMember && questions.length > 0 && (
              <section>
                <h2>What people asked it</h2>
                <p className="small muted" style={{ marginBottom: 8 }}>Visible to {team.name}, so the team sees what others need from it.</p>
                <ul className="list card tight">
                  {questions.map((q) => (
                    <li key={q.id}>
                      <span className="lead-col">{q.outcome === "answered" ? <Pill tone="green">Answered</Pill> : <Pill tone="violet">Routed</Pill>}</span>
                      <div className="grow"><div>{q.text}</div><div className="small muted">{q.asker_name}, {q.asker_team} · {fmtDateTime(q.created_at)}</div></div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside>
            <section>
              <h2>Profile</h2>
              <dl className="props">
                <div><dt>Team</dt><dd>{team.name}</dd></div>
                <div><dt>Manager</dt><dd>{lead?.name ?? "–"}</dd></div>
                <div><dt>Model</dt><dd>{hasModel ? "Claude" : "Offline writer (no API key)"}</dd></div>
                {!custom && <div><dt>Answers itself</dt><dd>{stats.answered} of {stats.total} questions, last 30 days</dd></div>}
                <div><dt>Can</dt><dd>{profile.actions.map((a) => AGENT_ACTIONS.find((x) => x.id === a)?.label).filter(Boolean).join("; ")}</dd></div>
                <div><dt>Approvals</dt><dd>{APPROVAL[profile.approval]}</dd></div>
                <div><dt>Runs</dt><dd>{SCHEDULE[profile.schedule]}</dd></div>
                {workers && <div><dt>Sandbox</dt><dd>Each job runs in its own isolated container</dd></div>}
                <div><dt>Reads for others</dt><dd>Only what the person asking may see</dd></div>
              </dl>
            </section>
            <section>
              <h2>Agents on {team.name}</h2>
              <ul className="list tight">
                {teamAgents.map((a) => (
                  <li key={a.id}>
                    <Avatar name={a.name} agent size={22} />
                    <Link className="grow" href={`/agents/${team.slug}${a.builtIn ? "" : `?agent=${a.id}`}`} style={{ fontWeight: a.id === profile.id ? 600 : 400 }}>{a.name}</Link>
                    <span className="small muted">{TIER_LABEL[a.tier]}</span>
                  </li>
                ))}
              </ul>
              {workers && isMember && <Link href={`/agents/new?team=${team.id}`} className="small" style={{ color: "var(--blue)" }}>+ Add a teammate</Link>}
            </section>
            {workers && <section>
              <h2>Budget</h2>
              <div className="row" style={{ justifyContent: "space-between" }}><span>${spent.toFixed(2)} used</span><span className="muted">of ${budget.toFixed(0)} this month</span></div>
              <div style={{ height: 8, background: "var(--line-2)", borderRadius: 4, marginTop: 6, overflow: "hidden" }} role="img" aria-label={`${Math.round(pct)}% of the monthly budget used`}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct > 85 ? "#dc2626" : "var(--blue)" }} />
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>Work stops when the budget runs out. Token costs only; web searches are billed separately.</p>
            </section>}
            <section>
              <h2>What it can read</h2>
              <ul className="small" style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
                <li>{counts.items} published updates and answers</li>
                {(() => {
                  const mineTools = profile.connectorIds.length ? tools.filter((t) => profile.connectorIds.includes(t.id)) : tools;
                  return <li>{mineTools.length} of {tools.length} connected tools: {mineTools.map((t) => `${CONNECTOR_LABEL[t.kind] ?? t.kind} (${t.name})`).join(", ")}</li>;
                })()}
                <li>{counts.meetings} {counts.meetings === 1 ? "meeting" : "meetings"} it attended</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
