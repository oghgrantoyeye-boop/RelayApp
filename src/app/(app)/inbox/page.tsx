import { currentViewer } from "@/lib/session";
import { fmtDateTime } from "@/lib/clock";
import { Pill, Topbar, type Tone } from "@/components/ui";
import { markInboxRead } from "@/app/actions";

const KIND: Record<string, [Tone, string]> = {
  ask_batch: ["blue", "Your batch of asks"],
  ask_now: ["red", "Urgent ask"],
  answer: ["green", "Answer"],
  commitment_alert: ["amber", "Commitment"],
  update: ["gray", "Update"],
  leadership_digest: ["violet", "Leadership digest"],
};

export default async function InboxPage() {
  const { db, viewer } = await currentViewer();
  const rows = await db.query(`select * from delivery where recipient_id = $1 order by created_at desc limit 100`, [viewer.user.id]);
  return (
    <>
      <Topbar crumbs={[viewer.user.name, "Inbox"]}>
        <form action={markInboxRead}><button className="b" type="submit">Mark all read</button></form>
      </Topbar>
      <div className="content">
        <div className="page-head">
          <div>
            <h1>Inbox</h1>
            <p>Everything Beacon sent you: alerts, answers and batches. In a pilot these also go to Slack and email{process.env.SLACK_WEBHOOK_URL ? " (Slack is connected)" : ""}.</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="card empty">Nothing yet. Answers to your questions, commitment alerts and your batch of asks land here.</div>
        ) : (
          <ul className="list card tight">
            {rows.map((r) => {
              const [tone, label] = KIND[r.kind] ?? ["gray", r.kind];
              return (
                <li key={r.id} style={{ background: r.read_at ? undefined : "#fbfbfd" }}>
                  <span className="lead-col"><Pill tone={tone}>{label}</Pill></span>
                  <div className="grow">
                    <div style={{ fontWeight: r.read_at ? 400 : 600 }}>{r.subject}</div>
                    <div className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{r.body}</div>
                    <div className="small muted" style={{ marginTop: 4 }}>{fmtDateTime(r.created_at)} UTC</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
