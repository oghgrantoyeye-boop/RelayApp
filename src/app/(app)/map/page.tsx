import { notFound } from "next/navigation";
import { workersEnabled } from "@/lib/flags";
import { currentViewer } from "@/lib/session";
import { commitmentViews } from "@/lib/commitments";
import { loadPolicy, refRequest } from "@/lib/data";
import { visibleLevel, LEVEL_LABEL, type Level } from "@/lib/permissions";
import { showRequest } from "@/lib/render";
import { fmt } from "@/lib/clock";
import { Topbar } from "@/components/ui";
import { TeamMap, type CState, type MapEdge, type MapNode } from "@/components/TeamMap";

// Fixed layout: Leadership on top, the delivery chain (Platform → Payments → Growth → Sales) across the middle.
const POS: Record<string, [number, number]> = {
  leadership: [500, 56],
  platform: [120, 210], payments: [370, 210], growth: [630, 210], sales: [880, 210],
  mobile: [120, 420], design: [370, 420], cs: [630, 420], finance: [880, 420],
};

export default async function MapPage() {
  if (!workersEnabled()) notFound();
  const { db, viewer, demo } = await currentViewer();
  const policy = await loadPolicy(db, viewer.orgId);
  const teams = await db.query(
    `select u.*, (select a.name from member m join app_user a on a.id = m.user_id where m.unit_id = u.id and m.role = 'lead' limit 1) as lead,
            (select count(*)::int from member m join app_user a on a.id = m.user_id where m.unit_id = u.id and a.kind = 'human') as people
     from unit u where u.org_id = $1 and u.how_to_ask <> '{}'::jsonb order by u.name`,
    [viewer.orgId],
  );
  const nodes: MapNode[] = teams
    .filter((t) => POS[t.id])
    .map((t) => ({ id: t.id, name: t.name, slug: t.slug, color: t.color, lead: t.lead, people: t.people, x: POS[t.id][0], y: POS[t.id][1] }));

  const edges: MapEdge[] = [];
  // Commitments, grouped by owner → waiting team, with the worst state. Titles at the viewer's level.
  const rank: Record<string, number> = { slipped: 3, at_risk: 2, on_track: 1 };
  const coms = (await commitmentViews(db, viewer.reader, (r) => r.status === "open" && !!r.waiting_unit_id)).filter((c) => c.waitingUnit && c.waitingUnit.id !== c.ownerUnit.id);
  for (const c of coms) {
    let e = edges.find((x) => x.type === "commitment" && x.from === c.ownerUnit.id && x.to === c.waitingUnit!.id);
    if (!e) edges.push((e = { type: "commitment", from: c.ownerUnit.id, to: c.waitingUnit!.id, count: 0, state: "on_track", items: [] }));
    e.count++;
    const st = (c.state === "slipped" || c.state === "at_risk" ? c.state : "on_track") as CState;
    if (rank[st] > rank[e.state!]) e.state = st;
    e.items.push(`${c.shown.title} (due ${fmt(c.due)})`);
  }
  // Open asks between teams, at the viewer's level.
  const reqs = await db.query(
    `select r.*, fu.name as from_name, tu.name as to_name from request r join unit fu on fu.id = r.from_unit_id join unit tu on tu.id = r.to_unit_id where r.status = 'open' and fu.org_id = $1`,
    [viewer.orgId],
  );
  for (const r of reqs) {
    const lvl = visibleLevel(policy, viewer.reader, refRequest(r)).level;
    const shown = showRequest(r, lvl, { from: r.from_name, to: r.to_name });
    if (!shown) continue;
    let e = edges.find((x) => x.type === "ask" && x.from === r.from_unit_id && x.to === r.to_unit_id);
    if (!e) edges.push((e = { type: "ask", from: r.from_unit_id, to: r.to_unit_id, count: 0, items: [] }));
    e.count++;
    if (!e.items.includes(shown.title)) e.items.push(shown.title);
  }
  // What each team shares with which teams.
  for (const i of await db.query(`select i.* from interface i join unit u on u.id = i.from_unit_id where u.org_id = $1`, [viewer.orgId])) {
    edges.push({ type: "share", from: i.from_unit_id, to: i.to_unit_id, count: 1, level: LEVEL_LABEL[i.level as Level].toLowerCase(), cadence: i.cadence, items: [`${(i.kinds as string[]).filter((k) => !k.startsWith("source:")).length} kinds of items${(i.kinds as string[]).some((k) => k.startsWith("source:")) ? ", plus tickets from their tools" : ""}`] });
  }

  return (
    <>
      <Topbar crumbs={[demo.org.name, "Team map"]} />
      <div className="content">
        <div className="page-head">
          <div>
            <h1>Team map</h1>
            <p>How {demo.org.short}&apos;s teams depend on each other right now: who owes whom, who is asking whom, and what each team shares. Click a team to focus on it. Details appear at your level of access.</p>
          </div>
        </div>
        <TeamMap nodes={nodes} edges={edges} viewerTeam={viewer.team.id} />
      </div>
    </>
  );
}
