import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { fmtDateTime } from "@/lib/clock";
import { Avatar, Topbar } from "@/components/ui";

const LABEL: Record<string, string> = {
  read_feed: "Read their feed",
  read_asks: "Opened their asks",
  agent_read: "Agent read published items",
  agent_answer: "Agent answered",
  agent_route: "Agent routed a question",
  publish_update: "Published an update",
  draft_update: "Drafted an update",
  share: "Shared items with a team",
  confirm_commitment: "Confirmed a commitment",
  revise_commitment: "Moved a commitment",
  reject_commitment: "Rejected a draft commitment",
  complete_commitment: "Closed a commitment",
  accept_request: "Accepted a request",
  answer_request: "Answered asks",
  publish_answer: "Published an answer",
  decline_request: "Declined a request",
  create_request: "Sent a request",
  send_batch: "Sent a batch of asks",
  digest_send: "Sent the leadership digest",
  follow: "Followed a team",
  unfollow: "Unfollowed a team",
  source_coding_session: "Coding agent session drafted",
  source_github_pr: "Pull request drafted",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action } = await searchParams;
  const { db, demo } = await currentViewer();
  const rows = await db.query(
    `select e.*, a.name as actor_name, a.kind as actor_kind, b.name as behalf_name
     from audit_event e left join app_user a on a.id = e.actor_id left join app_user b on b.id = e.on_behalf_of_id
     where ($1::text is null or e.action = $1) order by e.at desc, e.id desc limit 200`,
    [action ?? null],
  );
  const actions = await db.query(`select action, count(*)::int as n from audit_event group by action order by n desc`);
  return (
    <>
      <Topbar crumbs={[demo.org.name, "Audit log"]} />
      <div className="content">
        <div className="page-head">
          <div>
            <h1>Audit log</h1>
            <p>Every read, share, agent action and send, newest first. When an agent acts for someone, both are recorded.</p>
          </div>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <Link className="b chipb" href="/audit" aria-pressed={!action}>All</Link>
          {actions.slice(0, 12).map((a) => (
            <Link key={a.action} className="b chipb" href={`/audit?action=${a.action}`} aria-pressed={action === a.action}>
              {LABEL[a.action] ?? a.action} <span className="mono muted">{a.n}</span>
            </Link>
          ))}
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>When (UTC)</th><th>Who</th><th>On behalf of</th><th>What</th><th>Target</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.actor_name ? <span className="row" style={{ gap: 6 }}><Avatar name={r.actor_name} agent={r.actor_kind === "agent"} />{r.actor_name}</span> : <span className="muted">Beacon</span>}</td>
                  <td>{r.behalf_name ?? <span className="muted">–</span>}</td>
                  <td>{LABEL[r.action] ?? r.action}</td>
                  <td className="mono">{r.target_kind}{r.target_id ? `:${r.target_id}` : ""}</td>
                  <td className="mono small muted" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={JSON.stringify(r.detail)}>{JSON.stringify(r.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
