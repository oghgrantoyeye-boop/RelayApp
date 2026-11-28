// T-17: per team, what Beacon can see: each source as Live, Sample or Planned, with last sync,
// and the gaps. A tool that isn't really read never shows as Live.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { ago, whatBeaconSees } from "@/lib/visibility";
import { sid } from "./helpers";

describe("what Beacon can see", () => {
  let db: Db;
  const PLATFORM = sid("platform");

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("in a sample workspace, preview tools say Sample, not Live", async () => {
    const s = await whatBeaconSees(db, PLATFORM, { isSample: true });
    expect(s.rows.length).toBeGreaterThan(0);
    const tools = s.rows.filter((r) => r.tool !== "Claude Code");
    expect(tools.every((r) => r.status === "sample")).toBe(true);
  });

  it("in a real workspace, preview tools are Planned and only live connectors are Live, with last sync", async () => {
    await db.query(`update connector set mode = 'live', last_sync_at = $2 where unit_id = $1 and kind = 'github'`, [PLATFORM, "2026-12-06T08:56:00Z"]);
    const s = await whatBeaconSees(db, PLATFORM, { isSample: false });
    const gh = s.rows.find((r) => r.tool === "GitHub");
    expect(gh).toBeDefined();
    if (gh) {
      expect(gh.status).toBe("live");
      expect(gh.detail).toMatch(/synced 4 min ago$/);
    }
    const others = s.rows.filter((r) => r.tool !== "GitHub" && r.tool !== "Claude Code");
    expect(others.length).toBeGreaterThan(0);
    for (const r of others) {
      expect(r.status).toBe("planned");
      expect(r.detail).toMatch(/^Not connected yet/);
    }
    // Live rows come first.
    expect(s.rows[0].status === "live" || !s.rows.some((r) => r.status === "live")).toBe(true);
  });

  it("counts members who send Claude Code sessions", async () => {
    const ken = await db.one(`select user_id from member where unit_id = $1 and role <> 'agent' limit 1`, [PLATFORM]);
    await db.query(
      `insert into audit_event (org_id, actor_id, action, target_kind, target_id, detail, at) select org_id, $2, 'source_coding_session', 'update', 'x', '{}', $3 from unit where id = $1`,
      [PLATFORM, ken!.user_id, "2026-12-06T08:00:00Z"],
    );
    const s = await whatBeaconSees(db, PLATFORM, { isSample: false });
    const cc = s.rows.find((r) => r.tool === "Claude Code")!;
    expect(cc.status).toBe("live");
    expect(cc.detail).toMatch(/^1 of \d+ members send sessions$/);
  });

  it("names the gaps: kinds of context with nothing learned", async () => {
    await db.query(`update context_entry set status = 'retired' where unit_id = $1 and kind = 'capability'`, [PLATFORM]);
    const s = await whatBeaconSees(db, PLATFORM, { isSample: true });
    expect(s.gaps).toContain("Nothing learned yet about what Platform can take on.");
  });

  it("says how long ago", () => {
    const at = new Date("2026-12-06T09:00:00Z");
    expect(ago(new Date("2026-12-06T08:59:50Z"), at)).toBe("just now");
    expect(ago(new Date("2026-12-06T07:00:00Z"), at)).toBe("2 hours ago");
    expect(ago(new Date("2026-12-04T09:00:00Z"), at)).toBe("2 days ago");
  });
});
