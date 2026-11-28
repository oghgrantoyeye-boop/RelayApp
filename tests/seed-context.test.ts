// T-14: sample workspaces learn their team context from their own seeded history, with no
// hand-written context and no model calls.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { teamContext } from "@/lib/context";
import { DEMOS } from "@/lib/demos";
import { sid } from "./helpers";

describe("seeding by learning", () => {
  let db: Db;
  let fake: FakeLLM;
  const v = async (who: string): Promise<Viewer> => (await loadViewer(db, sid(who), "software"))!;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    fake = new FakeLLM({});
    setLLM(fake);
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("never calls a model to learn", () => {
    expect(fake.calls.filter((c) => c.task === "extract_context")).toHaveLength(0);
  });

  it("gives Platform the M2 picture: confirmed ownership, learned knowledge, what it runs and how to ask", async () => {
    const { active } = await teamContext(db, await v("ken"), sid("platform"));
    const line = (kind: string, title: string) => active.find((e) => e.kind === kind && e.title === title);

    const auth = line("responsibility", "Auth and SSO")!;
    expect(auth.tag).toBe("confirmed");
    expect(auth.body).toBe("Sign-in, SSO and the identity provider");
    expect(auth.origin).toMatch(/Ken Watanabe/);
    expect(active.filter((e) => e.kind === "responsibility")).toHaveLength(4);

    expect(line("system", "SAML single sign-on for internal tools like the admin dashboard")!.tag).toBe("learned");
    expect(line("system", "northwind/platform")!.tag).toBe("seen");
    expect(line("knows", "How do we load-test a new endpoint before launch")!.tag).toBe("learned");
    expect(active.some((e) => e.kind === "how_to_work" && /page on-call/.test(e.title))).toBe(true);
  });

  it("holds what Platform can take on for a teammate to confirm", async () => {
    const pending = await db.query(`select title from context_entry where unit_id = $1 and status = 'pending' and kind = 'capability' order by title`, [sid("platform")]);
    expect(pending.map((r) => r.title)).toEqual(["Load-testing new endpoints", "Reviewing new services before launch"]);
    const { active } = await teamContext(db, await v("ken"), sid("platform"));
    expect(active.some((e) => e.kind === "capability")).toBe(false);
  });

  it("records past answers on their requests", async () => {
    const r = (await db.one(`select status, answer_text, answered_by from request where id = $1`, [sid("rq_saml_tools")]))!;
    expect(r.status).toBe("answered");
    expect(r.answered_by).toBe(sid("ken"));
    expect(r.answer_text).toMatch(/SAML/);
  });

  it("every sample workspace learns something for each team that owns things", async () => {
    for (const pack of DEMOS.filter((d) => d.id !== "software")) {
      await seed(db, pack.id);
      const teams = new Set(pack.owns.map((o) => o[1]));
      for (const team of teams) {
        const n = (await db.one(`select count(*)::int as n from context_entry where unit_id = $1 and status = 'active'`, [`${pack.id}__${team}`]))!.n;
        expect(n, `${pack.id} ${team}`).toBeGreaterThan(0);
      }
    }
  });
});
