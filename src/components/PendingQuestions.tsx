// T-16: at most three things Beacon learned that wait for a teammate, asked as yes, no or not sure
// at the top of the team page. One yes makes the claim active; a no removes it and stops it being
// learned again; not sure leaves it for someone else.
import type { PendingQuestion } from "@/lib/context";
import { confirmContext, removeContext, unsureContext } from "@/app/actions/context";

function Hidden({ id, slug }: { id: string; slug: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={slug} />
    </>
  );
}

export function PendingQuestions({ items, slug }: { items: PendingQuestion[]; slug: string }) {
  if (items.length === 0) return null;
  return (
    <section className="stack" aria-label="Beacon's questions for your team" style={{ gap: 10, marginBottom: 14 }}>
      {items.map((p) => (
        <div key={p.id} className="card pending-q">
          <p style={{ margin: "0 0 4px" }}><strong>{p.question}</strong></p>
          {p.body && <div className="muted">{p.body}</div>}
          <div className="small muted" style={{ margin: "4px 0 8px" }}>{p.why}</div>
          <div className="row" style={{ gap: 6 }}>
            <form action={confirmContext}><Hidden id={p.id} slug={slug} /><button className="b bp sm" type="submit">Yes, that&apos;s right</button></form>
            <form action={removeContext}><Hidden id={p.id} slug={slug} /><button className="b sm" type="submit">No</button></form>
            <form action={unsureContext}><Hidden id={p.id} slug={slug} /><button className="b sm" type="submit">Not sure</button></form>
          </div>
        </div>
      ))}
    </section>
  );
}
