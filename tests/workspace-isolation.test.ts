// A real workspace never sees a sample workspace's teams, agents, meetings or demo story.
import { beforeAll, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { setNow } from "@/lib/clock";
import { seed } from "@/lib/seed";
import { upsertAccount } from "@/lib/auth/accounts";
import { createWorkspace } from "@/lib/auth/workspace-setup";
import { loadViewer, newId, type Viewer } from "@/lib/data";
import { listAgents, getAgent } from "@/lib/agents";
import { orgChart, search } from "@/lib/directory";
import { listMeetings } from "@/lib/meetings";
import { teamInfos } from "@/lib/updates";
import { chatContacts, resolveMention } from "@/lib/assistant";
import { activeDemo } from "@/lib/demo";
import { DEFAULT_DEMO, getDemo } from "@/lib/demos";
import { scoped } from "@/lib/scoped";

describe("workspace isolation", () => {
  let db: Db;
  let acme: Viewer;
  let orgId: string;
  const sample = getDemo(DEFAULT_DEMO);

  beforeAll(async () => {
    setNow("2026-12-06T09:00:00Z");
    delete process.env.BEACON_ADMIN_EMAILS;
    db = await openDb({});
    await migrate(db);
    await seed(db, DEFAULT_DEMO);
    await db.query(`insert into lead (id, email, status, source) values ($1, $2, 'approved', 'test')`, [newId("ld"), "solo@acme.test"]);
    const acct = await upsertAccount(db, { email: "solo@acme.test", name: "Sam Solo" });
    const ws = await createWorkspace(db, acct, { name: "Acme Solo", firstTeam: "General" });
    orgId = ws.orgId;
    acme = (await loadViewer(db, ws.userId, orgId))!;
  });

  it("lists only the workspace's own agents", async () => {
    const agents = await listAgents(db, orgId);
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.every((a) => a.team.id === acme.team.id)).toBe(true);
    const { mine, others } = await chatContacts(db, acme);
    expect([...mine, ...others].every((a) => a.team.id === acme.team.id)).toBe(true);
  });

  it("can't open or mention another workspace's agent", async () => {
    const platformAgent = `agent_${scoped(DEFAULT_DEMO, "platform")}`;
    expect(await getAgent(db, platformAgent, DEFAULT_DEMO)).not.toBeNull();
    expect(await getAgent(db, platformAgent, orgId)).toBeNull();
    expect(await resolveMention(db, orgId, "@Platform what changed?")).toBeNull();
  });

  it("directory, routing teams and meetings stay inside the workspace", async () => {
    const chart = await orgChart(db, orgId);
    expect(chart.map((u) => u.name)).toEqual(["General"]);
    const found = await search(db, "rate limits", orgId);
    expect(found.teams.every((t) => t.team.org_id === orgId)).toBe(true);
    expect((await teamInfos(db, orgId)).map((t) => t.name)).toEqual(["General"]);
    expect(await listMeetings(db, acme)).toEqual([]);
  });

  it("shows the workspace's own name and no demo story", async () => {
    const pack = await activeDemo(db, orgId);
    expect(pack.org.name).toBe("Acme Solo");
    expect(pack.guide).toEqual([]);
    expect(Object.keys(pack.ui.askExamples)).toEqual([]);
    expect(JSON.stringify({ org: pack.org, ui: pack.ui, intro: pack.intro })).not.toContain(sample.org.short);
    // The sample itself still gets its story.
    expect((await activeDemo(db, DEFAULT_DEMO)).org.name).toBe(sample.org.name);
  });
});
