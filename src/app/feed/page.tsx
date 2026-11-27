import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { getFeed, type FeedItem } from "@/lib/feed";
import { fmt, fmtLong, now } from "@/lib/clock";
import { Flash, Icon, KindPill, LevelTag, StatePill, TeamChip, Topbar } from "@/components/ui";
import { CommitmentLine } from "@/components/Commitment";

function Items({ items, empty }: { items: FeedItem[]; empty: string }) {
  if (items.length === 0) return <div className="card empty">{empty}</div>;
  return (
    <ul className="list card tight">
      {items.map((i) => (
        <li key={i.id}>
          <span className="lead-col"><KindPill kind={i.kind} /></span>
          <div className="grow">
            <div>{i.text}</div>
            <div className="small muted row" style={{ gap: 6, marginTop: 4 }}>
              <TeamChip team={i.team} />
              <span>{fmt(i.publishedAt)}</span>
              <LevelTag level={i.level} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer } = await currentViewer();
  const feed = await getFeed(db, viewer);
  const asks = await db.one(`select count(*)::int as n from request r join member m on m.id = r.assignee_member_id where m.user_id = $1 and r.status = 'open'`, [viewer.user.id]);
  const first = viewer.user.name.split(" ")[0];
  const mineCount = feed.asksForYou.length + feed.decisions.length + feed.risks.length + feed.progress.length;

  return (
    <>
      <Topbar crumbs={[viewer.team.name, "My feed"]}>
        <Link className="b" href="/write">Write update</Link>
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Good morning, {first}</h1>
            <p>
              {fmtLong(now())}. Updates from the {feed.following.length} teams {viewer.team.name} follows, filtered to what affects your team.
            </p>
          </div>
        </div>

        {feed.alerts.length > 0 && (
          <section className="card" aria-label="Commitments at risk" style={{ marginBottom: 20, borderColor: "#fde68a" }}>
            <div className="row">
              <span className="ai-head" style={{ color: "#92400e" }}><Icon name="commitments" size={14} />Needs your attention</span>
              <span className="small muted">Commitments your team owns or waits on that have slipped, or depend on something that has</span>
            </div>
            <ul className="list" style={{ marginTop: 6 }}>
              {feed.alerts.map((c) => (
                <li key={c.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                  <span className="lead-col"><StatePill state={c.state} daysLate={c.daysLate} /></span>
                  <CommitmentLine c={c} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {asks!.n > 0 && (
          <div className="notice" style={{ marginBottom: 20 }}>
            <Link href="/asks" style={{ color: "inherit" }}><strong>{asks!.n} {asks!.n === 1 ? "ask is" : "asks are"} waiting for you</strong>, merged into one list instead of separate messages. Open Asks</Link>
          </div>
        )}

        <div className="stack">
          {feed.asksForYou.length > 0 && (
            <section><h2>Asks for your team</h2><Items items={feed.asksForYou} empty="" /></section>
          )}
          <section><h2>Decisions that affect you</h2><Items items={feed.decisions} empty="No decisions from teams you follow affect your team in the last three weeks." /></section>
          <section><h2>Risks</h2><Items items={feed.risks} empty="No risks flagged for your team." /></section>
          <section><h2>Progress</h2><Items items={feed.progress} empty="No progress updates tagged for your team." /></section>
          <section>
            <h2>Other updates from teams you follow</h2>
            <p className="small muted" style={{ marginBottom: 8 }}>Not tagged for {viewer.team.name}. {mineCount} items above were.</p>
            <Items items={feed.otherUpdates} empty="Nothing else this week." />
          </section>
        </div>
      </div>
    </>
  );
}
