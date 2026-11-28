import { currentViewer } from "@/lib/session";
import { commitmentViews, teamCommitments, type CommitmentView } from "@/lib/commitments";
import { fmt } from "@/lib/clock";
import { Flash, StatePill, Topbar } from "@/components/ui";
import { CommitmentLine } from "@/components/Commitment";
import { PathInput } from "@/components/Nav";
import { commitmentAction } from "@/app/actions";

function Table({ rows, canClose, empty }: { rows: CommitmentView[]; canClose: boolean; empty: string }) {
  if (rows.length === 0) return <div className="card empty">{empty}</div>;
  return (
    <div className="tablewrap">
      <table>
        <thead><tr><th style={{ width: 120 }}>Status</th><th>Commitment</th><th style={{ width: 90 }}>Due</th>{canClose && <th style={{ width: 90 }} />}</tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><StatePill state={c.state} daysLate={c.daysLate} /></td>
              <td><CommitmentLine c={c} /></td>
              <td className="mono">{fmt(c.due)}</td>
              {canClose && (
                <td>
                  {c.state !== "done" && c.state !== "draft" && (
                    <form action={commitmentAction}>
                      <PathInput />
                      <input type="hidden" name="id" value={c.id} />
                      <button className="b sm" name="op" value="done">Mark done</button>
                    </form>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CommitmentsPage({ searchParams }: { searchParams: Promise<{ msg?: string; team?: string }> }) {
  const { msg, team: teamSlug } = await searchParams;
  const { db, viewer } = await currentViewer();
  const team = (teamSlug && (await db.one(`select * from unit where slug = $1 and org_id = $2`, [teamSlug, viewer.orgId]))) || viewer.team;
  const { owedBy, owedTo } = await teamCommitments(db, viewer, team.id);
  const mine = viewer.reader.unitIds.includes(team.id);
  const drafts = (await commitmentViews(db, viewer.reader, (r) => r.status === "draft")).filter((c) => c.row.owner_user_id === viewer.user.id);
  const slipped = [...owedBy, ...owedTo].filter((c) => c.state === "slipped").length;
  const atRisk = [...owedBy, ...owedTo].filter((c) => c.state === "at_risk").length;

  return (
    <>
      <Topbar crumbs={[{ href: `/teams/${team.slug}`, label: team.name }, "Commitments"]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Commitments</h1>
            <p>What {team.name} owes other teams, and what other teams owe it. Shown at your level of detail.</p>
          </div>
        </div>
        <div className="metrics">
          <div><div className="k">{team.name} owes</div><div className="v">{owedBy.filter((c) => c.state !== "done").length}</div></div>
          <div><div className="k">Owed to {team.name}</div><div className="v">{owedTo.filter((c) => c.state !== "done").length}</div></div>
          <div><div className="k">New date coming</div><div className="v">{slipped}</div></div>
          <div><div className="k">Waiting on a change</div><div className="v">{atRisk}</div></div>
        </div>

        {drafts.length > 0 && (
          <section className="card" style={{ marginBottom: 20, borderColor: "#ddd6fe" }}>
            <h2>Waiting for your confirmation</h2>
            <p className="small muted" style={{ marginBottom: 8 }}>Beacon found these promises in your updates. Only you can see them until you confirm.</p>
            <ul className="list">
              {drafts.map((c) => (
                <li key={c.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                  <div className="grow"><CommitmentLine c={c} /></div>
                  <form action={commitmentAction} className="row">
                    <PathInput />
                    <input type="hidden" name="id" value={c.id} />
                    <input type="date" name="due" defaultValue={c.due} aria-label="Due date" />
                    <button className="b bp sm" name="op" value="confirm">Confirm</button>
                    <button className="b sm" name="op" value="reject">Reject</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="stack">
          <section>
            <h2>{team.name} owes</h2>
            <Table rows={owedBy} canClose={mine} empty="No open commitments." />
          </section>
          <section>
            <h2>Owed to {team.name}</h2>
            <Table rows={owedTo} canClose={false} empty="No other team owes this team anything right now." />
          </section>
        </div>
      </div>
    </>
  );
}
