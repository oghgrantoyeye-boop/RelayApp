import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/lib/db";
import { summarizeFor } from "../src/lib/derive";
import { fakeLlm } from "../src/lib/llm/fake";
import { DEMO_REF, DEMO_TODAY, seed } from "../src/lib/seed/harborview";
import { seededDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await seededDb();
});

const val = (key: string) =>
  `(select value_json from field_value v where v.entity_id = e.id and v.field_id = 'f_${key}')`;

describe("Harborview seed", () => {
  it("has the brief's units and members", async () => {
    const units = await db.query<{ name: string }>("select name from unit order by name");
    expect(units.rows.map((u) => u.name)).toEqual([
      "Building plan review", "Fire prevention", "Inspections", "Permit center", "Public portal", "Utilities", "Zoning",
    ]);
    const agent = await db.query<{ unit_id: string; manager_id: string; config: any }>(
      "select unit_id, manager_id, config from member where kind = 'agent'",
    );
    expect(agent.rows).toEqual([
      expect.objectContaining({ unit_id: "fire", manager_id: "leo", config: expect.objectContaining({ budget: { monthly_usd: 150, used_usd: 84 } }) }),
    ]);
  });

  it("makes the queue metrics real: 186 open, median 38 days, 1.9 cycles, 14 blocked (6 on Fire)", async () => {
    const rows = (
      await db.query<{ ref: string; submitted: string; cycle: number; holder: string; reviews: any[] }>(`
        select e.external_ref as ref, ${val("submitted_at")} #>> '{}' as submitted, (${val("review_cycle")})::int as cycle,
               ${val("holder")} #>> '{}' as holder,
               json_build_array(${val("zoning_review")}, ${val("utilities_review")}, ${val("fire_review")}, ${val("building_review")}) as reviews
        from entity e`)
    ).rows;
    expect(rows.length).toBe(186);

    const days = rows
      .map((r) => (Date.parse(DEMO_TODAY) - Date.parse(r.submitted)) / 86_400_000)
      .sort((a, b) => a - b);
    expect((days[92] + days[93]) / 2).toBe(38);

    const avg = rows.reduce((s, r) => s + r.cycle, 0) / rows.length;
    expect(avg.toFixed(1)).toBe("1.9");

    const waiting = rows.flatMap((r) => r.reviews.filter((s) => s?.state === "waiting"));
    expect(waiting.length).toBe(14);
    expect(waiting.filter((s) => s.waiting_on === "fire").length).toBe(6);

    const byHolder = new Map<string, number>();
    for (const r of rows) byHolder.set(r.holder, (byHolder.get(r.holder) ?? 0) + 1);
    const top = [...byHolder].sort((a, b) => b[1] - a[1])[0];
    expect(top[0]).toBe("Fire prevention");
  });

  it("includes the eight named applications and the demo story", async () => {
    const refs = (await db.query<{ external_ref: string }>("select external_ref from entity")).rows.map((r) => r.external_ref);
    for (const ref of ["BP-2027-0418", "BP-2027-0369", "BP-2027-0381", "BP-2027-0402", "BP-2027-0397", "BP-2027-0390", "BP-2027-0375", "BP-2027-0388"]) {
      expect(refs).toContain(ref);
    }
    const story = await db.query<{ project: string; sprinkler: any; suggestion: number }>(`
      select ${val("project")} #>> '{}' as project, ${val("sprinkler_determination")} as sprinkler,
             (select count(*)::int from interface where status = 'suggested') as suggestion
      from entity e where external_ref = '${DEMO_REF}'`);
    expect(story.rows[0]).toMatchObject({ project: "12-unit apartment building", sprinkler: { state: "pending", proposed: "NFPA 13R" }, suggestion: 1 });
  });

  it("is idempotent", async () => {
    await seed(db);
    expect((await db.query<{ n: number }>("select count(*)::int as n from entity")).rows[0].n).toBe(186);
  });
});

describe("AI summaries", () => {
  it("are built only from what the reader can see", async () => {
    const llm = fakeLlm();
    const s = await summarizeFor(db, llm, "northline", DEMO_REF, { audience: "applicant" });
    const labels = llm.calls[0].facts.map((f) => f.label);
    expect(labels).toContain("Fire corrections");
    expect(labels).not.toContain("Fire internal notes");
    expect(labels).not.toContain("Fire reviewer");
    expect(s.text).not.toContain("1006.3.4");
    expect(s.text).not.toContain("Marcus");
  });
});
