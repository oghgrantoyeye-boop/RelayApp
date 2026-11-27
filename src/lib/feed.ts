import type { Db, Row } from "./db";
import { addDays, today } from "./clock";
import { audit, loadPolicy, refUpdateItem, type Viewer } from "./data";
import { commitmentViews, type CommitmentView } from "./commitments";
import { visibleLevel, type Level } from "./permissions";
import { showUpdateItem } from "./render";

export interface FeedItem {
  id: string;
  kind: string;
  text: string;
  level: Level;
  team: { id: string; name: string; slug: string; color: string };
  publishedAt: Date;
  affectsYou: boolean;
}

export interface Feed {
  asksForYou: FeedItem[];
  decisions: FeedItem[];
  risks: FeedItem[];
  progress: FeedItem[];
  otherUpdates: FeedItem[];
  alerts: CommitmentView[];
  following: Row[];
}

/** My feed: update items from teams you follow, at your level, grouped as the brief describes. */
export async function getFeed(db: Db, viewer: Viewer, days = 21): Promise<Feed> {
  const policy = await loadPolicy(db);
  const myUnits = viewer.reader.unitIds;
  const following = await db.query(
    `select distinct u.* from follow f join unit u on u.id = f.unit_id where f.follower_unit_id = any($1) and not (u.id = any($1)) order by u.name`,
    [myUnits],
  );
  const followedIds = following.map((u) => u.id);
  const rows = await db.query(
    `select i.*, u.name as unit_name, u.slug as unit_slug, u.color as unit_color
     from update_item i join unit u on u.id = i.unit_id
     where i.status = 'published' and i.unit_id = any($1) and i.published_at >= $2
     order by i.published_at desc`,
    [followedIds, addDays(today(), -days)],
  );

  const items: FeedItem[] = [];
  for (const r of rows) {
    const { level } = visibleLevel(policy, viewer.reader, refUpdateItem(r));
    const shown = showUpdateItem(r, level);
    if (!shown) continue;
    items.push({
      id: r.id,
      kind: r.kind,
      text: shown.text,
      level,
      team: { id: r.unit_id, name: r.unit_name, slug: r.unit_slug, color: r.unit_color },
      publishedAt: r.published_at,
      affectsYou: (r.affected_unit_ids as string[]).some((u) => myUnits.includes(u)),
    });
  }

  // Commitments that matter to your team and are slipping, including risk that flows down a chain.
  const alerts = (
    await commitmentViews(db, viewer.reader, (r) => r.status === "open" && (myUnits.includes(r.owner_unit_id) || myUnits.includes(r.waiting_unit_id)))
  ).filter((c) => c.state === "slipped" || c.state === "at_risk");

  const mine = items.filter((i) => i.affectsYou);
  const feed: Feed = {
    asksForYou: mine.filter((i) => i.kind === "ask"),
    decisions: mine.filter((i) => i.kind === "decision" || i.kind === "answer"),
    risks: mine.filter((i) => i.kind === "risk"),
    progress: mine.filter((i) => i.kind === "progress"),
    otherUpdates: items.filter((i) => !i.affectsYou).slice(0, 12),
    alerts,
    following,
  };
  await audit(db, {
    actorId: viewer.user.id,
    action: "read_feed",
    targetKind: "feed",
    targetId: viewer.team.id,
    detail: { items: items.length, levels: countBy(items.map((i) => i.level)), alerts: alerts.length },
  });
  return feed;
}

function countBy(xs: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}
