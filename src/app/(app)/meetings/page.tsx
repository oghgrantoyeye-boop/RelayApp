import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { listMeetings } from "@/lib/meetings";
import { fmtDateTime } from "@/lib/clock";
import { CONNECTOR_LABEL } from "@/lib/integrations";
import { Flash, Icon, Pill, TeamChip, Topbar, type Tone } from "@/components/ui";

const STATUS: Record<string, [Tone, string]> = {
  recorded: ["gray", "Recorded"],
  summarized: ["blue", "Summarized"],
  routed: ["green", "Routed to teams"],
};

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer } = await currentViewer();
  const meetings = await listMeetings(db, viewer);
  return (
    <>
      <Topbar crumbs={[viewer.team.name, "Meetings"]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Meetings</h1>
            <p>
              Meetings your team&apos;s agent attended, from Google Meet and Zoom. The transcript stays with the host team and the people who were there.
              Decisions and action items reach everyone else through updates, at their level.
            </p>
          </div>
        </div>
        {meetings.length === 0 ? (
          <div className="card empty">No meetings you attended or your team hosted.</div>
        ) : (
          <ul className="list card tight">
            {meetings.map((m) => {
              const [tone, label] = STATUS[m.status] ?? ["gray", m.status];
              return (
                <li key={m.id}>
                  <span className="lead-col"><Pill tone={tone}>{label}</Pill></span>
                  <div className="grow">
                    <Link href={`/meetings/${m.id}`} style={{ fontWeight: 600 }}>{m.title}</Link>
                    <div className="small muted row" style={{ gap: 6, marginTop: 4 }}>
                      <TeamChip team={{ name: m.unit_name, slug: m.unit_slug, color: m.unit_color }} />
                      <span>{fmtDateTime(m.starts_at)} UTC · {m.duration_min} min · {m.attendee_ids.length} people</span>
                      {m.source_kind && <span className="row" style={{ gap: 4 }}><Icon name="agent" size={13} />Agent attended via {CONNECTOR_LABEL[m.source_kind] ?? m.source_kind}</span>}
                      {m.marking_id && <Pill tone="red">Confidential</Pill>}
                    </div>
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
