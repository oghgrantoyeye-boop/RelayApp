import Link from "next/link";
import { notFound } from "next/navigation";
import { currentViewer } from "@/lib/session";
import { getTask, fmtCost, type Step } from "@/lib/work";
import { fmtDateTime } from "@/lib/clock";
import { Flash, Pill, Topbar } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { AutoRefresh } from "@/components/AutoRefresh";
import { taskAction } from "@/app/actions";
import { TASK_STATUS } from "@/components/taskStatus";

export const maxDuration = 300;

const STEP_ICON: Record<string, string> = { start: "▶", search: "⌕", read: "≡", note: "i", comment: "✎", redirect: "↪", takeover: "✋", done: "✓", error: "!" };

export default async function TaskPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { slug, id } = await params;
  const { msg } = await searchParams;
  const { db, viewer } = await currentViewer();
  const got = await getTask(db, viewer, id);
  if (!got) notFound();
  const { task: t, requester, takenOverBy } = got;
  const team = await db.one(`select * from unit where id = $1`, [t.unit_id]);
  const steps = (t.steps as Step[]) ?? [];
  const live = t.status === "queued" || t.status === "running";
  const [tone, label] = TASK_STATUS[t.status] ?? ["gray", t.status];
  const sources = (t.sources as { title: string; url?: string }[]) ?? [];

  return (
    <>
      <AutoRefresh active={live} />
      <Topbar crumbs={[{ href: `/agents/${slug}`, label: `${team!.name} agent` }, t.title]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <div className="row"><h1>{t.title}</h1><Pill tone={tone}>{label}</Pill></div>
            <p>
              {t.kind === "research" ? "Research" : "Draft update"} for {requester} · started {fmtDateTime(t.created_at)} UTC
              {takenOverBy && ` · taken over by ${takenOverBy}`}
            </p>
          </div>
        </div>
        <div className="two">
          <div className="primary">
            {t.status === "needs_key" && (
              <div className="notice warn">
                Research runs on Claude with web search, and this deployment has no ANTHROPIC_API_KEY. Add it to the environment and start the task again. Nothing was sent anywhere.
              </div>
            )}
            {t.status === "failed" && <div className="notice err">The agent stopped: {t.error}</div>}
            {t.result_md ? (
              <section className="card">
                <Markdown text={t.result_md} />
                {t.output_ref && (
                  <Link className="b bp" href={`/write?draft=${t.output_ref}`} style={{ marginTop: 6 }}>Review the draft</Link>
                )}
              </section>
            ) : (
              live && <section className="card"><p className="muted">Working… this page updates as the agent goes.</p></section>
            )}
            {sources.length > 0 && (
              <section>
                <h2>Sources</h2>
                <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                  {sources.map((s, i) => (
                    <li key={i}>{s.url && /^https?:\/\//.test(s.url) ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>{s.title || s.url}</a> : s.title}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card">
              <h2>Work on this together</h2>
              <p className="small muted" style={{ marginBottom: 8 }}>Everyone on {team!.name} sees this run.</p>
              <form action={taskAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={t.id} />
                <textarea name="text" rows={2} placeholder="Add a comment, or tell the agent what to change" aria-label="Comment or instruction" />
                <div className="row">
                  <button className="b" name="op" value="comment">Comment</button>
                  {t.kind === "research" && !takenOverBy && <button className="b" name="op" value="redirect">Redirect and rerun</button>}
                  {!takenOverBy && <button className="b" name="op" value="takeover" style={{ marginLeft: "auto" }}>Take over</button>}
                </div>
              </form>
            </section>
          </div>
          <aside>
            <section>
              <h2>Steps</h2>
              <ol className="list">
                {steps.map((s, i) => (
                  <li key={i} style={{ padding: "6px 0", border: 0, gap: 10 }}>
                    <span className="av" aria-hidden="true">{STEP_ICON[s.kind] ?? "·"}</span>
                    <div className="grow">
                      <div className="small">{s.by && <strong>{s.by}: </strong>}{s.text}</div>
                      <div className="small muted">{fmtDateTime(s.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h2>Usage</h2>
              <dl className="props">
                <div><dt>Cost</dt><dd>{fmtCost(t.cost_usd)} (tokens)</dd></div>
                <div><dt>Web searches</dt><dd>{t.searches}</dd></div>
                <div><dt>Tokens</dt><dd className="mono">{t.input_tokens.toLocaleString()} in · {t.output_tokens.toLocaleString()} out</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
