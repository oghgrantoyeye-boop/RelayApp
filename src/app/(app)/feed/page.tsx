import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { getFeed, type FeedItem } from "@/lib/feed";
import { fmt, fmtLong, now } from "@/lib/clock";
import { Flash, KindPill, LevelTag, TeamChip, Topbar } from "@/components/ui";

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
  const asks = await db.one(`select count(*)::int as n from request r left join member m on m.id = r.assignee_member_id where r.status = 'open' and (m.user_id = $1 or (r.destination = 'team_queue' and r.to_unit_id = any($2)))`, [viewer.user.id, viewer.reader.unitIds]);
  const first = viewer.user.name.split(" ")[0];
  const mineCount = feed.asksForYou.length + feed.decisions.length + feed.risks.length + feed.progress.length;

  return (
    <>
      <Topbar crumbs={[viewer.team.name, "What's changing"]}>
        <Link className="b" href="/write">Write update</Link>
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Good morning, {first}</h1>
            <p>
              {fmtLong(now())}. What changed in the {feed.following.length} teams {viewer.team.name} works with, filtered to what affects your team.
            </p>
          </div>
        </div>

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
          <section><h2>Other changes that affect you</h2><Items items={[...feed.progress, ...feed.risks].sort((a, b) => +b.publishedAt - +a.publishedAt)} empty="Nothing else from teams you follow affects your team in the last three weeks." /></section>
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
