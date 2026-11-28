import Link from "next/link";
import { notFound } from "next/navigation";
import { currentViewer } from "@/lib/session";
import { loadPolicy, refUpdateItem } from "@/lib/data";
import { visibleLevel, LEVEL_LABEL } from "@/lib/permissions";
import { showUpdateItem } from "@/lib/render";
import { latestUpdate } from "@/lib/updates";
import { commitmentViews } from "@/lib/commitments";
import { agentStats, getQuestion } from "@/lib/agent";
import { fmt } from "@/lib/clock";
import { Avatar, Flash, Icon, KindPill, LevelTag, Pill, StatePill, TeamChip, Topbar } from "@/components/ui";
import { CommitmentLine } from "@/components/Commitment";
import { askAgent, replyToAgent, sendRequest, toggleFollow } from "@/app/actions";
import { FollowUp } from "@/components/FollowUp";
import { teamConnectors, CONNECTOR_LABEL } from "@/lib/integrations";
import { teamContext } from "@/lib/context";
import { TeamContext } from "@/components/TeamContext";
import { AnswerClaims } from "@/components/AnswerClaims";

export default async function TeamPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ msg?: string; q?: string; ask?: string }> }) {
  const { slug } = await params;
  const { msg, q, ask } = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const team = await db.one(`select * from unit where slug = $1 and org_id = $2`, [slug, viewer.orgId]);
  if (!team) notFound();
  const policy = await loadPolicy(db, viewer.orgId);
  const isGroup = Object.keys(team.how_to_ask ?? {}).length === 0;
  const isMember = viewer.reader.unitIds.includes(team.id);
  const parent = team.parent_unit_id ? await db.one(`select * from unit where id = $1`, [team.parent_unit_id]) : null;
  const children = await db.query(`select * from unit where parent_unit_id = $1 order by name`, [team.id]);
  const members = await db.query(
    `select a.*, m.role from member m join app_user a on a.id = m.user_id where m.unit_id = $1 order by (m.role = 'agent'), (m.role = 'lead') desc, a.name`,
    [team.id],
  );
  const owns = await db.query(
    `select o.*, a.name as owner_name from ownership_item o left join member m on m.id = o.owner_member_id left join app_user a on a.id = m.user_id where o.unit_id = $1 order by o.title`,
    [team.id],
  );
  const followers = await db.query(`select u.* from follow f join unit u on u.id = f.follower_unit_id where f.unit_id = $1 order by u.name`, [team.id]);
  const follows = followers.some((f) => f.id === viewer.team.id);
  const iface = await db.one(`select * from interface where from_unit_id = $1 and to_unit_id = any($2) order by level`, [team.id, viewer.reader.unitIds]);
  const access = visibleLevel(policy, viewer.reader, { type: "update_item", kind: "decision", ownerUnitIds: [team.id], markingIds: [] });
  const latest = await latestUpdate(db, team.id);
  const open = (await commitmentViews(db, viewer.reader, (r) => r.owner_unit_id === team.id && r.status === "open")).sort((a, b) => a.due.localeCompare(b.due));
  const stats = isGroup ? null : await agentStats(db, team.id);
  const asked = q ? await getQuestion(db, viewer, q) : null;
  const lead = members.find((m) => m.role === "lead");
  const followUp = asked?.clarify ? (
    <FollowUp
      question={asked.clarify.question}
      options={asked.clarify.options}
      action={replyToAgent}
      field="reply"
      done={!!asked.followUpId}
      hidden={<><input type="hidden" name="questionId" value={asked.question.id} /><input type="hidden" name="slug" value={team.slug} /></>}
    />
  ) : null;
  const tools = isGroup ? [] : await teamConnectors(db, team.id);
  const context = isGroup ? null : await teamContext(db, viewer, team.id);

  return (
    <>
      <Topbar crumbs={[{ href: "/directory", label: "Directory" }, ...(parent ? [{ href: `/teams/${parent.slug}`, label: parent.name }] : []), team.name]}>
        {!isMember && !isGroup && (
          <form action={toggleFollow}>
            <input type="hidden" name="unitId" value={team.id} />
            <input type="hidden" name="slug" value={team.slug} />
            <button className="b" type="submit">{follows ? `Unfollow (as ${viewer.team.name})` : `Follow as ${viewer.team.name}`}</button>
          </form>
        )}
        {isMember && <Link className="b bp" href="/write">Write update</Link>}
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div className="grow">
            <div className="row">
              <span className="swatch" style={{ background: team.color, width: 12, height: 12, borderRadius: 3 }} />
              <h1>{team.name}</h1>
              {lead && <Pill tone="gray" dot={false}>Lead: {lead.name}</Pill>}
            </div>
            <p style={{ marginTop: 4 }}>{team.description}</p>
            <p className="small" style={{ marginTop: 6 }}>
              {isMember
                ? "You're on this team, so you see everything at Full detail."
                : `You see ${team.name}'s updates at ${LEVEL_LABEL[access.level]}${iface ? ` because ${viewer.team.name} follows it` : ", the default for teams you don't follow"}.`}
            </p>
          </div>
        </div>

        <div className="two">
          <div className="primary">
            {!isGroup && (
              <section className="card" id="agent" aria-label={`Ask the ${team.name} agent`}>
                <div className="row">
                  <span className="ai-head"><Icon name="agent" size={14} />Ask the {team.name} agent</span>
                  {stats && stats.total > 0 && (
                    <span className="small muted" style={{ marginLeft: "auto" }}>Answered {stats.answered} of {stats.total} questions itself in the last 30 days</span>
                  )}
                  {isMember && <Link className="b sm" href={`/agents/${team.slug}`} style={{ marginLeft: stats && stats.total > 0 ? 8 : "auto" }}>Agent workspace</Link>}
                </div>
                <p className="small muted" style={{ marginTop: 4 }}>
                  It answers only from what {team.name} has published, at your level. If it can&apos;t, it sends your question to the person who owns that area, in their next batch of asks.
                </p>
                {asked && (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--soft)", borderRadius: 8 }}>
                    <div className="small muted">You asked</div>
                    <div style={{ fontWeight: 500 }}>{asked.question.text}</div>
                    {asked.question.outcome === "answered" && asked.claims.length > 0 ? (
                      <AnswerClaims claims={asked.claims} gaps={asked.gaps} followUp={asked.clarify && followUp} />
                    ) : asked.question.outcome === "clarify" ? (
                      <div style={{ marginTop: 8 }}>{followUp}</div>
                    ) : (
                      <>
                        <div className="ai-body" style={{ marginTop: 8 }}>{asked.question.answer_text}</div>
                        {asked.gaps.length > 0 && <AnswerClaims claims={[]} gaps={asked.gaps} />}
                      </>
                    )}
                    <div className="row small muted" style={{ marginTop: 8 }}>
                      {asked.question.outcome === "answered" ? <Pill tone="green">Answered by the agent</Pill> : asked.question.outcome === "clarify" ? <Pill tone="amber">Waiting for your reply</Pill> : <Pill tone="violet">Routed to a person</Pill>}
                      {asked.sources.length > 0 && <span>Sources:</span>}
                      {asked.sources.map((s) => (
                        <span key={s.ref} className="chip" title={s.text}>{s.label} <LevelTag level={s.level} /></span>
                      ))}
                    </div>
                  </div>
                )}
                <form action={askAgent} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input type="hidden" name="unitId" value={team.id} />
                  <input type="hidden" name="slug" value={team.slug} />
                  <textarea name="question" rows={2} required defaultValue={ask ?? ""} placeholder={`For example: ${demo.ui.askExamples[team.id] ?? "What did you decide about this?"}`} aria-label="Your question" />
                  <div className="row">
                    <label className="check small"><input type="checkbox" name="blocking" /> This is blocking me</label>
                    <label className="row small muted">Needed by <input type="date" name="neededBy" aria-label="Needed by" /></label>
                    <button className="b bp" type="submit" style={{ marginLeft: "auto" }}>Ask</button>
                  </div>
                </form>
              </section>
            )}

            {context && <TeamContext team={team as { name: string; slug: string }} {...context} />}

            <section>
              <h2>Latest update{latest && <span className="small muted" style={{ fontWeight: 400 }}> · {fmt(latest.update.published_at)}</span>}</h2>
              {latest ? (
                <ul className="list card tight">
                  {latest.items.map((i) => {
                    const lvl = visibleLevel(policy, viewer.reader, refUpdateItem(i)).level;
                    const shown = showUpdateItem(i, lvl);
                    if (!shown) return null;
                    return (
                      <li key={i.id}>
                        <span className="lead-col"><KindPill kind={i.kind} /></span>
                        <div className="grow">{shown.text} <LevelTag level={lvl} /></div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="card empty">No updates published yet.</div>
              )}
            </section>

            <section>
              <h2>Active work</h2>
              {open.length === 0 ? (
                <div className="card empty">Nothing in progress that {team.name} has shared.</div>
              ) : (
                <ul className="list card tight">
                  {open.map((c) => (
                    <li key={c.id}>
                      {c.state === "draft" && <span className="lead-col"><StatePill state={c.state} /></span>}
                      <CommitmentLine c={c} calm />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!isGroup && !isMember && (
              <section className="card">
                <h2>How to ask {team.name}</h2>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  Expected turnaround: {team.how_to_ask.turnaround}. Your request goes to whoever owns the area, in one batch with their other asks, unless it&apos;s blocking.
                </p>
                <form action={sendRequest} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input type="hidden" name="unitId" value={team.id} />
                  <input type="hidden" name="slug" value={team.slug} />
                  <label className="field"><span>What do you need?</span><input type="text" name="title" required /></label>
                  <label className="field"><span>Details: why, and what's blocked without it</span><textarea name="details" rows={3} /></label>
                  <div className="row">
                    <label className="row small muted">Needed by <input type="date" name="neededBy" aria-label="Needed by" /></label>
                    <label className="check small"><input type="checkbox" name="blocking" /> Blocking</label>
                    <button className="b" type="submit" style={{ marginLeft: "auto" }}>Send request</button>
                  </div>
                </form>
              </section>
            )}
          </div>

          <aside aria-label="About this team">
            {owns.length > 0 && (
              <section>
                <h2>Owns</h2>
                <dl className="props">
                  {owns.map((o) => (
                    <div key={o.id}><dt>{o.title}</dt><dd><div>{o.owner_name}</div><div className="small muted">{o.description}</div></dd></div>
                  ))}
                </dl>
              </section>
            )}
            {tools.length > 0 && (
              <section>
                <h2>Connected tools</h2>
                <div className="row">{tools.map((t) => <span key={t.id} className="chip" title={t.name}>{CONNECTOR_LABEL[t.kind] ?? t.kind}</span>)}</div>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {isMember ? "Its agent reads these to answer questions and draft updates." : `Their content stays inside ${team.name} unless an interface shares it with you.`}
                </p>
              </section>
            )}
            {children.length > 0 && (
              <section>
                <h2>Teams</h2>
                <div className="row">{children.map((c) => <TeamChip key={c.id} team={c} />)}</div>
              </section>
            )}
            <section>
              <h2>Members</h2>
              <ul className="list">
                {members.map((m) => (
                  <li key={m.id} style={{ padding: "6px 0", border: 0 }}>
                    <Avatar name={m.name} agent={m.kind === "agent"} />
                    <div>
                      <div>{m.name} {m.role === "lead" && <span className="small muted">· lead</span>}</div>
                      <div className="small muted">{m.title}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            {!isGroup && (
              <section>
                <h2>Followers</h2>
                {followers.length ? <div className="row">{followers.map((f) => <TeamChip key={f.id} team={f} />)}</div> : <p className="muted">No followers yet.</p>}
                <p className="small muted" style={{ marginTop: 8 }}>
                  Followers see updates at Summary. Everyone else at {demo.org.short} sees Headlines.
                  {iface && ` ${viewer.team.name} gets ${LEVEL_LABEL[iface.level as "full"]} ${iface.cadence === "immediate" ? "right away" : `in a ${iface.cadence} digest`}.`}
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
