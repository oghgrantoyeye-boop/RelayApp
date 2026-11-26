import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/lib/db";
import { summarizeFor } from "../src/lib/derive";
import { fakeLlm } from "../src/lib/llm/fake";
import { DEMO_REF, DEMO_TODAY, TOTAL_OPEN, seed } from "../src/lib/seed";
import { seededDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await seededDb();
});

const val = (key: string) => `(select value_json from field_value v where v.entity_id = e.id and v.field_id = 'f_${key}')`;

describe("Larkspur demo pack", () => {
  it("has the six teams, the partner unit and an agent member", async () => {
    const units = await db.query<{ name: string }>("select name from unit order by name");
    expect(units.rows.map((u) => u.name)).toEqual([
      "Compliance", "Engineering", "Marketing", "Product", "Retail partners", "Sales", "Supply chain",
    ]);
    const agent = await db.query<{ unit_id: string; manager_id: string; config: any }>(
      "select unit_id, manager_id, config from member where kind = 'agent'",
    );
    expect(agent.rows).toEqual([
      expect.objectContaining({ unit_id: "compliance", manager_id: "omar", config: expect.objectContaining({ budget: { monthly_usd: 150, used_usd: 84 } }) }),
    ]);
  });

  it("makes the metrics real: 64 open, median 41 days, 1.9 handoff rounds, 9 blocked (4 on Compliance)", async () => {
    const rows = (
      await db.query<{ started: string; rounds: number; holder: string; statuses: any[] }>(`
        select ${val("started_at")} #>> '{}' as started, (${val("handoff_rounds")})::int as rounds,
               ${val("holder")} #>> '{}' as holder,
               json_build_array(${val("engineering_status")}, ${val("compliance_status")}, ${val("supply_status")},
                                ${val("marketing_status")}, ${val("sales_status")}) as statuses
        from entity e`)
    ).rows;
    expect(rows.length).toBe(TOTAL_OPEN);

    const days = rows.map((r) => (Date.parse(DEMO_TODAY) - Date.parse(r.started)) / 86_400_000).sort((a, b) => a - b);
    expect((days[31] + days[32]) / 2).toBe(41);

    const avg = rows.reduce((s, r) => s + r.rounds, 0) / rows.length;
    expect(avg.toFixed(1)).toBe("1.9");

    const waiting = rows.flatMap((r) => r.statuses.filter((s) => s?.state === "waiting"));
    expect(waiting.length).toBe(9);
    expect(waiting.filter((s) => s.waiting_on === "compliance").length).toBe(4);

    const byHolder = new Map<string, number>();
    for (const r of rows) byHolder.set(r.holder, (byHolder.get(r.holder) ?? 0) + 1);
    expect([...byHolder].sort((a, b) => b[1] - a[1])[0][0]).toBe("Compliance");
  });

  it("includes the eight named initiatives and the demo story", async () => {
    const refs = (await db.query<{ external_ref: string }>("select external_ref from entity")).rows.map((r) => r.external_ref);
    for (const ref of ["LK-014", "LK-009", "LK-011", "LK-016", "LK-012", "LK-007", "LK-015", "LK-010"]) expect(refs).toContain(ref);
    const story = await db.query(`
      select ${val("name")} #>> '{}' as name, ${val("certification")} as cert,
             (select count(*)::int from interface where status = 'suggested') as suggestions
      from entity e where external_ref = '${DEMO_REF}'`);
    expect(story.rows[0]).toMatchObject({
      name: "Trailhead e-bike spring launch",
      cert: { state: "pending", proposed: "UL 2849 via Intertek" },
      suggestions: 1,
    });
  });

  it("is idempotent", async () => {
    await seed(db);
    expect((await db.query<{ n: number }>("select count(*)::int as n from entity")).rows[0].n).toBe(TOTAL_OPEN);
  });
});

describe("AI summaries", () => {
  it("are built only from what the reader can see", async () => {
    const llm = fakeLlm();
    const s = await summarizeFor(db, llm, "summit", DEMO_REF, { audience: "retail partner" });
    const labels = llm.calls[0].facts.map((f) => f.label);
    expect(labels).toContain("Compliance");
    expect(labels).not.toContain("Compliance internal notes");
    expect(labels).not.toContain("Compliance reviewer");
    expect(s.text).not.toContain("UN 38.3");
    expect(s.text).not.toContain("Nina");
  });
});
