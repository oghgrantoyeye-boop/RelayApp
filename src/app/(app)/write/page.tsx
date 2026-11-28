import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { getDraft, myDrafts } from "@/lib/updates";
import { fmt, fmtDateTime } from "@/lib/clock";
import { Flash, Pill, Topbar } from "@/components/ui";
import { analyze, discardDraft, publish } from "@/app/actions";


const SOURCE_LABEL: Record<string, string> = { manual: "Written update", meeting: "Meeting notes", coding_agent: "Coding agent session", github: "GitHub pull request", agent: "Agent draft from your tools" };

export default async function WritePage({ searchParams }: { searchParams: Promise<{ msg?: string; draft?: string; example?: string }> }) {
  const { msg, draft: draftId, example } = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const teams = viewer.units.filter((u) => Object.keys(u.how_to_ask ?? {}).length > 0 || u.role === "lead");
  const allTeams = await db.query(`select id, name from unit where org_id = $1 and how_to_ask <> '{}'::jsonb order by name`, [viewer.orgId]);

  if (draftId) {
    let draft: Awaited<ReturnType<typeof getDraft>> = null;
    let err: string | null = null;
    try {
      draft = await getDraft(db, viewer, draftId);
    } catch (e) {
      err = (e as Error).message;
    }
    if (!draft || draft.update.status !== "draft") {
      return (
        <>
          <Topbar crumbs={[{ href: "/write", label: "Write update" }, "Draft"]} />
          <div className="content"><div className="notice warn">{err ?? "This draft was already published or discarded."}</div></div>
        </>
      );
    }
    const { update, items, commitments } = draft;
    return (
      <>
        <Topbar crumbs={[{ href: "/write", label: "Write update" }, `Review: ${update.unit_name}`]} />
        <div className="content">
          <Flash msg={msg} />
          <div className="page-head">
            <div>
              <h1>Review before publishing</h1>
              <p>
                {SOURCE_LABEL[update.source]} for {update.unit_name}, drafted {fmtDateTime(update.created_at)} UTC. Nothing is shared until you publish.
                Teams that follow {update.unit_name} will see the Summary; everyone else sees the Headline.
              </p>
            </div>
          </div>
          <form action={publish} className="stack">
            <input type="hidden" name="updateId" value={update.id} />
            {commitments.length > 0 && (
              <section>
                <h2>Commitments Beacon found</h2>
                <p className="small muted" style={{ marginBottom: 8 }}>Promises with a date. When you publish, the waiting team and everyone downstream are told.</p>
                <div className="stack" style={{ gap: 12 }}>
                  {commitments.map((c) => (
                    <div key={c.id} className="card" style={{ borderColor: "#ddd6fe" }}>
                      <input type="hidden" name="c_ids" value={c.id} />
                      <div className="row">
                        {c.owner_user_id && c.owner_user_id !== viewer.user.id && !c.revises_id ? (
                          <span className="small" style={{ fontWeight: 500 }}>Draft for {c.owner_name} to confirm</span>
                        ) : (
                          <label className="check"><input type="checkbox" name={`confirm_${c.id}`} defaultChecked /> Confirm</label>
                        )}
                        {c.revises_id ? (
                          <Pill tone="amber">Moves an existing commitment from {fmt(c.revises_due)} to the date below</Pill>
                        ) : (
                          <Pill tone="violet">New commitment</Pill>
                        )}
                        {c.waiting_name && <span className="small muted">Waiting team: {c.waiting_name}</span>}
                      </div>
                      <div className="row" style={{ marginTop: 8 }}>
                        <label className="field grow"><span>Commitment</span><input type="text" name={`ctitle_${c.id}`} defaultValue={c.revises_title ?? c.title} /></label>
                        <label className="field"><span>Due</span><input type="date" name={`cdue_${c.id}`} defaultValue={c.due_date} /></label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2>Items ({items.length})</h2>
              <div className="stack" style={{ gap: 12 }}>
                {items.map((i, n) => (
                  <div key={i.id} className="card">
                    <input type="hidden" name="item_ids" value={i.id} />
                    <div className="row" style={{ marginBottom: 8 }}>
                      <label className="check"><input type="checkbox" name={`include_${i.id}`} defaultChecked /> Include item {n + 1}</label>
                      <select name={`kind_${i.id}`} defaultValue={i.kind} aria-label="Kind">
                        <option value="progress">Progress</option>
                        <option value="decision">Decision</option>
                        <option value="risk">Risk</option>
                        <option value="ask">Ask</option>
                      </select>
                    </div>
                    <label className="field"><span>Full detail (your team and anyone granted full)</span><textarea name={`text_${i.id}`} rows={2} defaultValue={i.text} /></label>
                    <div className="row" style={{ marginTop: 8, alignItems: "flex-start" }}>
                      <label className="field grow"><span>Summary (followers)</span><input type="text" name={`summary_${i.id}`} defaultValue={i.summary_text} /></label>
                      <label className="field grow"><span>Headline (everyone at {demo.org.short})</span><input type="text" name={`headline_${i.id}`} defaultValue={i.headline_text} /></label>
                    </div>
                    <fieldset style={{ border: 0, padding: 0, margin: "10px 0 0" }}>
                      <legend className="small muted" style={{ marginBottom: 4 }}>Affects (suggested from ownership and routing; edit freely)</legend>
                      <div className="row">
                        {allTeams.filter((t) => t.id !== update.unit_id).map((t) => (
                          <label key={t.id} className="check small chip">
                            <input type="checkbox" name={`affected_${i.id}`} value={t.id} defaultChecked={(i.affected_unit_ids as string[]).includes(t.id)} /> {t.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                ))}
              </div>
            </section>
            <div className="row">
              <button className="b bp" type="submit">Publish to {update.unit_name}&apos;s page</button>
            </div>
          </form>
          <form action={discardDraft} style={{ marginTop: 10 }}>
            <input type="hidden" name="updateId" value={update.id} />
            <button className="b" type="submit">Discard draft</button>
          </form>
        </div>
      </>
    );
  }

  const drafts = await myDrafts(db, viewer);
  const { localId } = await import("@/lib/scoped");
  const exampleText = example ? demo.ui.writeExamples[localId(demo.id, viewer.team.id)] ?? Object.values(demo.ui.writeExamples)[0] : "";
  return (
    <>
      <Topbar crumbs={[viewer.team.name, "Write update"]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Write update</h1>
            <p>Write or paste an update or meeting notes. Beacon splits it into items, tags the teams it affects and finds commitments. You review everything before it&apos;s shared.</p>
          </div>
        </div>
        <div className="two">
          <form action={analyze} className="primary card" style={{ gap: 10 }}>
            <div className="row">
              <label className="field"><span>Team</span>
                <select name="unitId" defaultValue={teams[0]?.id}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </label>
              <label className="field"><span>Kind</span>
                <select name="source" defaultValue={example ? "meeting" : "manual"}><option value="manual">Written update</option><option value="meeting">Meeting notes</option></select>
              </label>
              <Link href="/write?example=1" className="small" style={{ marginLeft: "auto", color: "var(--blue)" }}>Paste example notes for {viewer.team.name}</Link>
            </div>
            <textarea name="text" rows={12} required defaultValue={exampleText} placeholder={"What happened this week, what you decided, what's at risk, and what you need from other teams.\n\nFor example: We'll finish it by Dec 9."} aria-label="Update text" />
            <div className="row"><button className="b bp" type="submit">Split into items</button></div>
          </form>
          <aside>
            <section>
              <h2>Your drafts</h2>
              {drafts.length === 0 ? (
                <p className="muted">No drafts. Sessions from your coding agent and merged pull requests show up here. <Link href="/connect" style={{ color: "var(--blue)" }}>Connect tools</Link></p>
              ) : (
                <ul className="list">
                  {drafts.map((d) => (
                    <li key={d.id} style={{ padding: "8px 0" }}>
                      <div>
                        <Link href={`/write?draft=${d.id}`} style={{ fontWeight: 500 }}>{SOURCE_LABEL[d.source]}</Link>
                        <div className="small muted">{d.unit_name} · {d.item_count} items · {fmtDateTime(d.created_at)} UTC</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
