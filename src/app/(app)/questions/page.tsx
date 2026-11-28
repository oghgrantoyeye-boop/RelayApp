// My questions (T-26, mock M5): everything the viewer asked, where it went and why, its status and
// the reply, with the next step for anything waiting: That answers it, Ask a follow-up, reply with
// the detail the team asked for, or, once it has gone unanswered, Send to the lead or Ask again.
import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { fmtDateTime } from "@/lib/clock";
import { MY_STATE, myQuestions, UNRESOLVED_AFTER_BUSINESS_DAYS, type MyQuestion } from "@/lib/requests";
import { Flash, Pill, Topbar } from "@/components/ui";
import { myQuestionAction } from "@/app/actions";

function Status({ q }: { q: MyQuestion }) {
  const s = MY_STATE[q.state];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

function Hidden({ q }: { q: MyQuestion }) {
  return (
    <>
      <input type="hidden" name="key" value={q.key} />
      <input type="hidden" name="questionId" value={q.questionId ?? ""} />
      <input type="hidden" name="unitId" value={q.unitId} />
    </>
  );
}

function Detail({ q }: { q: MyQuestion }) {
  const lastDone = q.steps.map((s) => s.done).lastIndexOf(true);
  return (
    <section className="card" style={{ margin: "14px 0" }} aria-label="Selected question">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <strong style={{ fontSize: 15 }}>{q.text}</strong>
        <Status q={q} />
      </div>
      <ol className="steps" aria-label="Progress">
        {q.steps.map((s, i) => (
          <li key={i} className={`step${s.done ? " done" : ""}${i === lastDone ? " on" : ""}`}>
            {s.label}
            {s.sub && <><br /><span className="muted">{s.sub}</span></>}
          </li>
        ))}
      </ol>
      {q.why && <p className="small muted" style={{ margin: "0 0 8px" }}>{q.why}</p>}
      {q.reply && (
        <div className="route"><strong>{q.reply.by}:</strong> {q.reply.text}</div>
      )}

      {(q.state === "needs_info" || q.state === "clarify") && q.ask && (
        <div className="route">
          <strong>{q.state === "clarify" ? "Beacon asked" : `${q.team} asked`}:</strong> {q.ask}
          <form action={myQuestionAction} className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Hidden q={q} />
            <input type="hidden" name="op" value={q.state === "clarify" ? "clarify" : "reply"} />
            {q.clarifyOptions.map((o) => (
              <button key={o} className="b sm" type="submit" name="reply" value={o}>{o}</button>
            ))}
            <input type="text" name="reply" placeholder="Your reply" aria-label="Your reply" style={{ minWidth: 260 }} />
            <button className="b bp sm" type="submit">Send</button>
          </form>
        </div>
      )}

      {q.state === "unresolved" && (
        <div className="row" style={{ marginTop: 10 }}>
          <form action={myQuestionAction}><Hidden q={q} /><button className="b bp" name="op" value="lead" type="submit">Send to the lead</button></form>
          <form action={myQuestionAction}><Hidden q={q} /><button className="b" name="op" value="again" type="submit">Ask again</button></form>
          <span className="muted small">No one on {q.team} has answered in {UNRESOLVED_AFTER_BUSINESS_DAYS} business days.</span>
        </div>
      )}

      {(q.state === "answered" || q.state === "agent_answered" || q.state === "resolved") && (
        <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
          {q.state === "answered" && (
            <form action={myQuestionAction}><Hidden q={q} /><button className="b bp" name="op" value="resolve" type="submit">That answers it</button></form>
          )}
          <details>
            <summary className="b">Ask a follow-up</summary>
            <form action={myQuestionAction} className="row" style={{ gap: 6, marginTop: 8 }}>
              <Hidden q={q} />
              <input type="hidden" name="op" value="followup" />
              <input type="text" name="question" required placeholder={`Ask ${q.team} more`} aria-label="Your follow-up" style={{ minWidth: 300 }} />
              <button className="b bp sm" type="submit">Ask</button>
            </form>
          </details>
          {q.requestId && <span className="muted small">Shared only with you. Beacon learned the general fact for {q.team}&apos;s page.</span>}
        </div>
      )}
      {q.state === "awaiting_team" && (
        <p className="muted small" style={{ marginTop: 10 }}>
          Waiting on {q.team}. If no one answers in {UNRESOLVED_AFTER_BUSINESS_DAYS} business days you can send it to the lead or ask again.
        </p>
      )}
    </section>
  );
}

export default async function MyQuestionsPage({ searchParams }: { searchParams: Promise<{ msg?: string; open?: string }> }) {
  const { msg, open } = await searchParams;
  const { db, viewer } = await currentViewer();
  const list = await myQuestions(db, viewer);
  const selected = list.find((q) => q.key === open) ?? list[0];
  return (
    <>
      <Topbar crumbs={[viewer.user.name, "My questions"]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>My questions</h1>
            <p>Everything you asked, where it went, and what&apos;s happened since.</p>
          </div>
        </div>
        {list.length === 0 ? (
          <div className="card empty">
            You haven&apos;t asked anything yet. <Link href="/directory">Find a team</Link> or ask Beacon, and your questions will show up here.
          </div>
        ) : (
          <>
            {selected && <Detail q={selected} />}
            <div className="tablewrap">
              <table>
                <thead><tr><th>Question</th><th>Went to</th><th>Status</th><th>Last change</th></tr></thead>
                <tbody>
                  {list.map((q) => (
                    <tr key={q.key} aria-selected={q.key === selected?.key}>
                      <td><Link href={`/questions?open=${encodeURIComponent(q.key)}`}>{q.text}</Link></td>
                      <td>{q.wentTo}</td>
                      <td><Status q={q} /></td>
                      <td>{fmtDateTime(q.lastChange)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
