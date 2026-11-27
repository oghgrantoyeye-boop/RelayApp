import Link from "next/link";
import { notFound } from "next/navigation";
import { currentViewer } from "@/lib/session";
import { attendeeName, getMeeting, type MeetingSummary } from "@/lib/meetings";
import { fmt, fmtDateTime } from "@/lib/clock";
import { CONNECTOR_LABEL } from "@/lib/integrations";
import { Avatar, Flash, Icon, Pill, TeamChip, Topbar } from "@/components/ui";
import { routeMeetingAction, summarizeMeetingAction } from "@/app/actions";

export const maxDuration = 120;

export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { id } = await params;
  const { msg } = await searchParams;
  const { db, viewer } = await currentViewer();
  const got = await getMeeting(db, viewer, id);
  if (!got) notFound();
  const { meeting: m, attendees, canRoute } = got;
  const s = m.summary as MeetingSummary | null;
  return (
    <>
      <Topbar crumbs={[{ href: "/meetings", label: "Meetings" }, m.title]}>
        {s && canRoute && (
          m.update_id && m.status === "routed" ? (
            <Link className="b" href={`/write?draft=${m.update_id}`}>Open the routed update</Link>
          ) : (
            <form action={routeMeetingAction}><input type="hidden" name="id" value={m.id} /><button className="b bp">Route to affected teams</button></form>
          )
        )}
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <div className="row">
              <h1>{m.title}</h1>
              {m.marking_label && <Pill tone="red">{m.marking_label}</Pill>}
            </div>
            <p className="row" style={{ gap: 8, marginTop: 6 }}>
              <TeamChip team={{ name: m.unit_name, slug: m.unit_slug, color: m.unit_color }} />
              {fmtDateTime(m.starts_at)} UTC · {m.duration_min} min
              {m.source_kind && <span className="row" style={{ gap: 4 }}><Icon name="agent" size={13} />{m.unit_name}&apos;s agent attended via {CONNECTOR_LABEL[m.source_kind]}</span>}
            </p>
          </div>
        </div>
        <div className="two">
          <div className="primary">
            <section className="card">
              <div className="row">
                <span className="ai-head"><Icon name="spark" size={14} />What happened</span>
                {s && <span className="small muted" style={{ marginLeft: "auto" }}>Summarized by {s.by}</span>}
              </div>
              {!s ? (
                <div style={{ marginTop: 10 }}>
                  <p className="muted">The agent has the transcript but hasn&apos;t summarized it yet.</p>
                  <form action={summarizeMeetingAction} style={{ marginTop: 10 }}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="b bp">Summarize the meeting</button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="ai-body">{s.summary}</div>
                  {s.decisions.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 14 }}>Decisions</h3>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>{s.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
                    </>
                  )}
                  {s.risks.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 14 }}>Risks</h3>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>{s.risks.map((d, i) => <li key={i}>{d}</li>)}</ul>
                    </>
                  )}
                  {s.action_items.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 14 }}>Action items</h3>
                      <ul className="list">
                        {s.action_items.map((a, i) => (
                          <li key={i} style={{ padding: "6px 0", border: 0 }}>
                            <Avatar name={attendeeName(attendees, a.owner)} />
                            <div className="grow">{a.text}<div className="small muted">{attendeeName(attendees, a.owner)}{a.due ? ` · by ${fmt(a.due)}` : ""}</div></div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {canRoute && m.status !== "routed" && (
                    <p className="small muted" style={{ marginTop: 12 }}>
                      Routing drafts an update for you to review: decisions and risks go to the teams they affect, at their level, and each action
                      item becomes a draft commitment that only its owner sees until they confirm it.
                    </p>
                  )}
                  <form action={summarizeMeetingAction} style={{ marginTop: 10 }}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="b sm">Summarize again</button>
                  </form>
                </>
              )}
            </section>
            <section>
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Transcript</summary>
                <div className="card" style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.transcript}</div>
              </details>
            </section>
          </div>
          <aside>
            <section>
              <h2>Attendees ({attendees.length})</h2>
              <ul className="list">
                {attendees.map((a) => (
                  <li key={a.id} style={{ padding: "6px 0", border: 0 }}>
                    <Avatar name={a.name} />
                    <div><div>{a.name}</div><div className="small muted">{a.title}{a.team ? `, ${a.team}` : ""}</div></div>
                  </li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 8 }}>Only the host team and these people can read this page.</p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
