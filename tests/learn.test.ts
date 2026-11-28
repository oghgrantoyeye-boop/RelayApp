// The learning engine (T-11): Beacon turns a team's own activity into team context. Low-risk claims
// apply as learned, ownership and capabilities wait for a teammate, marked sources always wait,
// the same source never counts twice, and something the team removed stays removed.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { learnFrom } from "@/lib/context-learn";
import { extractContext } from "@/lib/ai/offline";
import { clearLearned, sid } from "./helpers";

describe("learning team context", () => {
  let db: Db;
  const entries = (unit = "platform") =>
    db.query(`select * from context_entry where unit_id = $1 order by first_seen_at, title`, [sid(unit)]);

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({})); // no canned answer: the offline extractor runs
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    await clearLearned(db);
  });

  it("the offline extractor finds ownership, systems, capabilities, how to ask and what an answer shows the team knows", () => {
    const claims = extractContext({
      kind: "answer",
      question: "How do I load-test a new endpoint?",
      text: "Lena runs these for every team. We own the staging cluster. We can help with load testing before a launch. Book a review in #platform-asks.",
    });
    expect(claims.map((c) => c.kind).sort()).toEqual(["capability", "how_to_work", "knows", "responsibility"]);
    expect(claims.find((c) => c.kind === "knows")!.title).toBe("How do I load-test a new endpoint");
  });

  it("applies low-risk claims, holds ownership and capabilities for confirmation, and audits it", async () => {
    const r = await learnFrom(db, {
      unitId: sid("platform"),
      kind: "answer",
      ref: "rq_test1",
      label: "Lena Fischer's answer",
      question: "How do I load-test a new endpoint?",
      text: "We own the staging cluster. We can help with load testing before a launch. Book a review in #platform-asks.",
      actorId: sid("lena"),
    });
    expect(r.signals).toBe(4);
    const rows = await entries();
    const by = (k: string) => rows.find((e) => e.kind === k)!;
    expect(by("knows").status).toBe("active");
    expect(by("how_to_work").status).toBe("active");
    expect(by("responsibility").status).toBe("pending");
    expect(by("capability").status).toBe("pending");
    expect(by("knows").provenance).toBe("learned");
    expect(by("knows").source_refs[0]).toMatchObject({ kind: "answer", ref: "rq_test1", label: "Lena Fischer's answer" });
    const ev = await db.one(`select * from audit_event where action = 'context_learn' order by at desc limit 1`);
    expect(ev!.detail.pending).toHaveLength(2);
  });

  it("never counts the same source twice, and a second source strengthens the entry", async () => {
    const src = {
      unitId: sid("platform"),
      kind: "pr" as const,
      ref: "platform/deploy#120",
      label: "PR #120",
      repo: "platform/deploy",
      text: "Cache build layers.",
    };
    await learnFrom(db, src);
    await learnFrom(db, src);
    let sys = (await entries()).filter((e) => e.kind === "system");
    expect(sys).toHaveLength(1);
    expect(sys[0].source_refs).toHaveLength(1);
    const before = Number(sys[0].confidence);
    await learnFrom(db, { ...src, ref: "platform/deploy#121", label: "PR #121", text: "Parallel test shards." });
    sys = (await entries()).filter((e) => e.kind === "system");
    expect(sys).toHaveLength(1);
    expect(sys[0].source_refs).toHaveLength(2);
    expect(Number(sys[0].confidence)).toBeGreaterThan(before);
  });

  it("anything learned from a marked source waits for confirmation and inherits the marking", async () => {
    await learnFrom(db, {
      unitId: sid("sales"),
      kind: "agent_chat",
      ref: "msg_1",
      label: "Sales chat",
      text: "Book a review in #sales-deals.",
      markingIds: [sid("mk_conf")],
    });
    const [e] = await entries("sales");
    expect(e.status).toBe("pending");
    expect(e.marking_ids).toEqual([sid("mk_conf")]);
  });

  it("something the team removed is not learned again", async () => {
    await learnFrom(db, {
      unitId: sid("platform"),
      kind: "pr",
      ref: "a#1",
      label: "PR #1",
      repo: "platform/legacy-cron",
      text: "Bump deps.",
    });
    await db.query(`update context_entry set status = 'retired' where unit_id = $1`, [sid("platform")]);
    const r = await learnFrom(db, {
      unitId: sid("platform"),
      kind: "pr",
      ref: "a#2",
      label: "PR #2",
      repo: "platform/legacy-cron",
      text: "Bump more deps.",
    });
    expect(r.created).toEqual([]);
    expect((await entries()).every((e) => e.status === "retired")).toBe(true);
  });

  it("uses the model's claims when it answers", async () => {
    setLLM(new FakeLLM({ extract_context: { claims: [{ kind: "system", title: "Edge proxy", body: "Platform runs the edge proxy." }] } }));
    const r = await learnFrom(db, {
      unitId: sid("platform"),
      kind: "update",
      ref: "up_1",
      label: "Platform update",
      text: "Moved the edge proxy to the new cluster.",
    });
    expect(r.by).toBe("Fake model");
    expect((await entries()).map((e) => e.title)).toContain("Edge proxy");
  });
});
