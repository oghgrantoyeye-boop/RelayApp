import Link from "next/link";
import { notFound } from "next/navigation";
import { currentViewer } from "@/lib/session";
import { listTasks, fmtCost } from "@/lib/work";
import { agentStats } from "@/lib/agent";
import { teamConnectors, CONNECTOR_LABEL } from "@/lib/integrations";
import { getLLM } from "@/lib/ai/llm";
import { fmtDateTime } from "@/lib/clock";
import { Flash, Icon, Pill, Topbar } from "@/components/ui";
import { TASK_STATUS } from "@/components/taskStatus";
import { startTaskAction } from "@/app/actions";

// Server actions on this page start agent work that keeps running after the response.
export const maxDuration = 300;


export default async function AgentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { slug } = await params;
  const { msg } = await searchParams;
  const { db, viewer } = await currentViewer();
  const team = await db.one(`select * from unit where slug = $1 and how_to_ask <> '{}'::jsonb`, [slug]);
  if (!team) notFound();
  const agent = await db.one(`select a.* from app_user a join member m on m.user_id = a.id where m.unit_id = $1 and a.kind = 'agent'`, [team.id]);
  if (!agent) notFound();
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
  const spent = Number(agent.spent_usd);
  const budget = Number(agent.monthly_budget_usd ?? 0);
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const hasModel = !!getLLM().research;

  return (
    <>
      <Topbar crumbs={[{ href: `/teams/${team.slug}`, label: team.name }, agent.name]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div className="row" style={{ gap: 12 }}>
            <span className="av agent" style={{ width: 40, height: 40, fontSize: 13 }}>AI</span>
            <div>
              <h1>{agent.name}</h1>
              <p>A member of {team.name}. It answers questions from other teams, does research and drafts updates for the team. People approve anything that leaves the team.</p>
            </div>
          </div>
        </div>

        <div className="two">
          <div className="primary">
            {isMember ? (
              <section className="card">
                <div className="row"><span className="ai-head"><Icon name="agent" size={14} />Give the agent work</span></div>
                <p className="small muted" style={{ marginTop: 4 }}>Every task is visible to all of {team.name}. Anyone on the team can comment, redirect it or take it over.</p>
                <form action={startTaskAction} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="hidden" name="unitId" value={team.id} />
                  <input type="hidden" name="slug" value={team.slug} />
                  <div className="row">
                    <label className="check"><input type="radio" name="kind" value="research" defaultChecked /> Research with me</label>
                    <label className="check"><input type="radio" name="kind" value="draft_update" /> Draft our weekly update from our tools</label>
                  </div>
                  <textarea name="instructions" rows={3} placeholder="For research: what should it find out? For example: How do other payment APIs limit webhook retry traffic per merchant, and what do they tell customers?" aria-label="Instructions" />
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
            )}

            {isMember && (
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
                              <td><Link href={`/agents/${team.slug}/tasks/${t.id}`} style={{ fontWeight: 500 }}>{t.title}</Link><div className="small muted">{t.kind === "research" ? "Research" : "Draft update"}</div></td>
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
                <div><dt>Answers itself</dt><dd>{stats.answered} of {stats.total} questions, last 30 days</dd></div>
                <div><dt>Needs approval to</dt><dd>Share anything outside {team.name}, or confirm commitments</dd></div>
                <div><dt>Reads for others</dt><dd>Only what the person asking may see</dd></div>
              </dl>
            </section>
            <section>
              <h2>Budget</h2>
              <div className="row" style={{ justifyContent: "space-between" }}><span>${spent.toFixed(2)} used</span><span className="muted">of ${budget.toFixed(0)} this month</span></div>
              <div style={{ height: 8, background: "var(--line-2)", borderRadius: 4, marginTop: 6, overflow: "hidden" }} role="img" aria-label={`${Math.round(pct)}% of the monthly budget used`}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct > 85 ? "#dc2626" : "var(--blue)" }} />
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>Work stops when the budget runs out. Token costs only; web searches are billed separately.</p>
            </section>
            <section>
              <h2>What it can read</h2>
              <ul className="small" style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
                <li>{counts.items} published updates and answers</li>
                <li>{counts.docs} items from {tools.length} connected tools: {tools.map((t) => CONNECTOR_LABEL[t.kind] ?? t.kind).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</li>
                <li>{counts.meetings} {counts.meetings === 1 ? "meeting" : "meetings"} it attended</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
