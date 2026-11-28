import { currentViewer } from "@/lib/session";
import { getAsks } from "@/lib/agent";
import { addDays, fmt, fmtDateTime, today } from "@/lib/clock";
import { Avatar, Flash, LevelTag, Pill, Topbar } from "@/components/ui";
import { answerAsk, sendMyBatch } from "@/app/actions";

export default async function AsksPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer } = await currentViewer();
  const { clusters, nextBatch, pending } = await getAsks(db, viewer);
  const people = new Set(clusters.flatMap((c) => c.askers.map((a) => a.name))).size;
  const viaAgent = clusters.reduce((n, c) => n + c.requests.filter((r) => r.via === "agent").length, 0);

  return (
    <>
      <Topbar crumbs={[viewer.user.name, "Asks for you"]}>
        <form action={sendMyBatch}><button className="b" type="submit" disabled={pending === 0}>Send my batch now</button></form>
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Asks for you</h1>
            <p>
              What people want from you, in one place instead of separate emails and messages. Questions about the same thing are merged, and the soonest ones come first.
              Your batch goes out {viewer.user.ask_cadence}, next at {fmtDateTime(nextBatch)} UTC.
            </p>
          </div>
        </div>
        <div className="metrics">
          <div><div className="k">Open asks</div><div className="v">{clusters.length}</div></div>
          <div><div className="k">People waiting</div><div className="v">{people}</div></div>
          <div><div className="k">Routed by team agents</div><div className="v">{viaAgent}</div></div>
          <div><div className="k">Not yet in a batch</div><div className="v">{pending}</div></div>
        </div>
        {clusters.length === 0 && <div className="card empty">Nothing waiting on you. Team agents answer what your team has already published.</div>}
        <div className="stack" style={{ gap: 14 }}>
          {clusters.map((c) => (
            <section key={c.key} className="card">
              <div className="row">
                {c.urgent && <Pill tone="amber">Soon</Pill>}
                {c.askers.length > 1 && <Pill tone="blue">{c.askers.length} people asked</Pill>}
                {c.destination === "team_queue" && <Pill tone="violet">{c.requests[0].to_name} queue</Pill>}
                {c.ownership && <span className="small muted">About {c.ownership}</span>}
                {c.neededBy && <span className="small muted">· needed by {fmt(c.neededBy)}</span>}
                <span className="small muted" style={{ marginLeft: "auto" }}>{c.delivered ? "Delivered" : "In your next batch"}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>{c.title} <LevelTag level={c.level} /></div>
              {c.details && c.details !== `Asked the ${c.requests[0].to_name ?? ""} agent.` && <p className="muted" style={{ marginTop: 4 }}>{c.details}</p>}
              {c.reason && <p className="small muted" style={{ marginTop: 4 }}>{c.reason}</p>}
              {c.restricted && <p className="small" style={{ marginTop: 6, color: "#92400e" }}>Some details are hidden from you: {c.restricted}.</p>}
              <div className="row small muted" style={{ marginTop: 8 }}>
                <span className="avs">{c.askers.map((a, i) => <Avatar key={i} name={a.name} />)}</span>
                <span>{c.askers.map((a) => `${a.name} (${a.team})`).join(", ")}</span>
              </div>
              {c.requests.length > 1 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="small" style={{ cursor: "pointer" }}>How each person asked</summary>
                  <ul className="small muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {c.requests.map((r) => <li key={r.id}>{r.requester_name}: &ldquo;{r.title}&rdquo; ({fmt(r.created_at)}{r.via === "agent" ? ", via agent" : ""})</li>)}
                  </ul>
                </details>
              )}
              <form action={answerAsk} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="hidden" name="key" value={c.key} />
                <textarea name="answer" rows={2} placeholder="Answer once. It goes to everyone who asked." aria-label="Your answer" />
                <div className="row small">
                  <label className="check"><input type="checkbox" name="publish" defaultChecked={c.askers.length > 1} /> Publish to my team&apos;s page so the agent can answer it next time, at</label>
                  <select name="publishLevel" defaultValue="summary" aria-label="Publish level">
                    <option value="full">Full detail</option>
                    <option value="summary">Summary</option>
                    <option value="headline">Headline</option>
                  </select>
                </div>
                <div className="row small">
                  <label className="check"><input type="checkbox" name="commit" /> Also commit to deliver by</label>
                  <input type="date" name="due" defaultValue={addDays(today(), 3)} aria-label="Commitment due date" />
                  <span className="grow" />
                  <button className="b" type="submit" name="decline" value="1">Decline</button>
                  <button className="b bp" type="submit">Answer {c.askers.length > 1 ? `all ${c.askers.length}` : ""}</button>
                </div>
              </form>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
