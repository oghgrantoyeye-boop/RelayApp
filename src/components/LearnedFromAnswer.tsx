// T-24: after someone answers a question, show what Beacon learned from the answer and whether it
// still needs a teammate. The answer itself stays private to the askers; only the general fact
// goes onto the team's page, and the team can confirm, fix or drop it right here.
import Link from "next/link";
import type { LearnedView } from "@/lib/context";
import { confirmContext, fixContext, removeContext } from "@/app/actions/context";
import { Pill } from "./ui";

function Hidden({ id, slug, back }: { id: string; slug: string; back: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="back" value={back} />
    </>
  );
}

export function LearnedFromAnswer({ team, slug, entries, back }: { team: string; slug: string; entries: LearnedView[]; back: string }) {
  const kept = entries.filter((e) => e.status !== "retired");
  return (
    <section className="card learned" aria-label="What Beacon learned">
      <h2>What Beacon learned</h2>
      {kept.length === 0 ? (
        <p className="muted">
          {entries.length > 0 ? "You dropped what Beacon learned from this answer. It won't learn it again from it." : `Nothing lasting to add to ${team}'s page from this answer. The reply still went to everyone who asked.`}
        </p>
      ) : (
        <ul className="ctx-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {kept.map((e) => (
            <li key={e.id} className="ctx-entry">
              <div className="grow">
                <div>
                  <span className="ctx-kind">{e.kindLabel}</span>
                  <strong>{e.title}</strong>{" "}
                  {e.status === "pending" ? <Pill tone="amber">Needs confirming</Pill> : e.confirmed ? <Pill tone="green">Confirmed</Pill> : <Pill tone="blue">On {team}&apos;s page</Pill>}
                </div>
                {e.body && <div className="muted">{e.body}</div>}
                <div className="small muted">{e.why ?? `Other teams' questions can be answered from this now.`}</div>
                <details className="ctx-fix">
                  <summary className="b sm">Fix</summary>
                  <form action={fixContext} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    <Hidden id={e.id} slug={slug} back={back} />
                    <label className="field"><span>What it is</span><input type="text" name="title" defaultValue={e.title} required maxLength={160} /></label>
                    <label className="field"><span>Details</span><textarea name="body" rows={2} defaultValue={e.body} maxLength={600} /></label>
                    <div className="row"><button className="b bp sm" type="submit">Save fix</button></div>
                  </form>
                </details>
              </div>
              <div className="row ctx-acts">
                {!e.confirmed && (
                  <form action={confirmContext}><Hidden id={e.id} slug={slug} back={back} /><button className="b bp sm" type="submit">Looks right</button></form>
                )}
                <form action={removeContext}><Hidden id={e.id} slug={slug} back={back} /><button className="b sm" type="submit">Don&apos;t keep</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>
        The answer itself stays private to the people who asked. <Link href={`/teams/${slug}#knows`}>See everything Beacon knows about {team}</Link>
      </p>
    </section>
  );
}
