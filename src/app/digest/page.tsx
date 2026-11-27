import { currentViewer } from "@/lib/session";
import { buildDigest } from "@/lib/digest";
import { fmt } from "@/lib/clock";
import { Flash, Icon, Pill, StatePill, TeamChip, Topbar } from "@/components/ui";
import { CommitmentLine } from "@/components/Commitment";
import { sendDigest } from "../actions";

export default async function DigestPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer } = await currentViewer();
  const d = await buildDigest(db, viewer.reader);
  const isLeadership = viewer.reader.unitIds.includes("leadership");
  return (
    <>
      <Topbar crumbs={["Leadership", "Digest"]}>
        {isLeadership && <form action={sendDigest}><button className="b bp" type="submit">Email to Leadership</button></form>}
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Leadership digest, week of {fmt(d.weekOf)}</h1>
            <p>
              One paragraph per team, written only from what you can see{isLeadership ? "" : ` as ${viewer.team.name}`}. A paragraph built from a confidential input is
              confidential too.
            </p>
          </div>
        </div>
        {!isLeadership && (
          <div className="notice warn" style={{ marginBottom: 16 }}>
            You&apos;re viewing as {viewer.user.name}. Leadership sees more detail; this version only uses what {viewer.team.name} may see.
          </div>
        )}
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="row">
            <span className="ai-head"><Icon name="spark" size={14} />This week across Northwind</span>
            <span className="small muted" style={{ marginLeft: "auto" }}>Written by {d.by}</span>
          </div>
          <ul className="list" style={{ marginTop: 8 }}>
            {d.paragraphs.map((p) => (
              <li key={p.team.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                <span className="lead-col"><TeamChip team={p.team} /></span>
                <div className="grow">
                  <div className="ai-body" style={{ marginTop: 0 }}>{p.text}</div>
                  {p.markingLabels.length > 0 && <div style={{ marginTop: 6 }}>{p.markingLabels.map((l) => <Pill key={l} tone="red">{l}</Pill>)}</div>}
                </div>
              </li>
            ))}
          </ul>
          {d.hidden > 0 && (
            <p className="small muted" style={{ marginTop: 8 }}>
              {d.hidden} {d.hidden === 1 ? "paragraph is" : "paragraphs are"} hidden because {d.hidden === 1 ? "it was" : "they were"} built from items marked for other teams.
            </p>
          )}
        </section>
        <section>
          <h2>Slipped commitments ({d.slipped.length})</h2>
          {d.slipped.length === 0 ? (
            <div className="card empty">Nothing has slipped.</div>
          ) : (
            <ul className="list card tight">
              {d.slipped.map((c) => (
                <li key={c.id}>
                  <span className="lead-col"><StatePill state={c.state} daysLate={c.daysLate} /></span>
                  <CommitmentLine c={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
