// A team's connected tools and what they synced, as the viewer may see them.
import type { Db, Row } from "./db";
import { now } from "./clock";
import { audit, loadPolicy, newId, refSource, type Viewer } from "./data";
import { assertWrite, visibleLevel } from "./permissions";
import { showSource } from "./render";

export const CONNECTOR_LABEL: Record<string, string> = {
  slack: "Slack",
  jira: "Jira",
  linear: "Linear",
  github: "GitHub",
  gdrive: "Google Drive",
  notion: "Notion",
  zoom: "Zoom",
  gmeet: "Google Meet",
  teams: "Microsoft Teams",
  zendesk: "Zendesk",
  figma: "Figma",
  confluence: "Confluence",
  hubspot: "HubSpot",
};

/** Tools a team can add in the demo. Adding one creates the connection with Northwind's fictional data. */
export const CATALOG = ["slack", "jira", "linear", "github", "gdrive", "notion", "zoom", "gmeet", "teams", "confluence", "hubspot", "zendesk", "figma"];

export async function teamConnectors(db: Db, unitId: string): Promise<Row[]> {
  return db.query(
    `select c.*, a.name as connected_by_name, (select count(*)::int from source_doc d where d.connector_id = c.id) as items,
            (select count(*)::int from meeting m where m.connector_id = c.id) as meetings
     from connector c left join app_user a on a.id = c.connected_by where c.unit_id = $1 order by c.kind, c.name`,
    [unitId],
  );
}

/** Recent synced items from a team's tools, at the viewer's level. Outsiders see only what an interface shares. */
export async function recentSourceItems(db: Db, viewer: Viewer, unitId: string, limit = 12) {
  const policy = await loadPolicy(db, viewer.orgId);
  const docs = await db.query(
    `select d.*, c.kind as connector_kind, c.name as connector_name from source_doc d join connector c on c.id = d.connector_id where d.unit_id = $1 order by d.occurred_at desc`,
    [unitId],
  );
  const out: { row: Row; shown: NonNullable<ReturnType<typeof showSource>> }[] = [];
  for (const d of docs) {
    const shown = showSource(d, visibleLevel(policy, viewer.reader, refSource(d)).level);
    if (shown) out.push({ row: d, shown });
    if (out.length >= limit) break;
  }
  return out;
}

export async function addConnector(db: Db, viewer: Viewer, unitId: string, kind: string) {
  assertWrite(viewer.reader, unitId, "connect tools for this team");
  if (!CATALOG.includes(kind)) throw new Error("Unknown tool");
  const unit = await db.one(`select name, slug from unit where id = $1`, [unitId]);
  const name = kind === "slack" ? `#${unit!.slug}` : `${CONNECTOR_LABEL[kind]} (${unit!.name})`;
  const id = newId("cn");
  await db.query(`insert into connector (id, unit_id, kind, name, connected_by, last_sync_at, created_at) values ($1, $2, $3, $4, $5, $6, $6)`, [
    id, unitId, kind, name, viewer.user.id, now(),
  ]);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "connect_tool", targetKind: "connector", targetId: id, detail: { kind } });
  return id;
}

export async function syncConnector(db: Db, viewer: Viewer, connectorId: string) {
  const c = await db.one(`select * from connector where id = $1`, [connectorId]);
  if (!c) throw new Error("Not found");
  assertWrite(viewer.reader, c.unit_id, "sync this team's tools");
  await db.query(`update connector set last_sync_at = $2 where id = $1`, [connectorId, now()]);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "sync_tool", targetKind: "connector", targetId: connectorId });
}
