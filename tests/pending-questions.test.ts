// T-16: pending claims are asked as yes, no or not sure at the top of the team page (at most three)
// and ride along in each member's batch of asks. One yes makes a claim active.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { confirmEntry, pendingQuestions, retireEntry, teamContext, unsureEntry, PENDING_SHOWN } from "@/lib/context";
import { learnFrom } from "@/lib/context-learn";
import { sendBatch } from "@/lib/agent";
import { sid } from "./helpers";

describe("pending questions", () => {
  let db: Db;
  const v = async (who: string): Promise<Viewer> => (await loadViewer(db, sid(who), "software"))!;
  const PLATFORM = sid("platform");

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("asks Platform's members about what Platform can take on, with where it was learned and why", async () => {
    const qs = await pendingQuestions(db, await v("ken"), PLATFORM);
    const lt = qs.find((q) => q.title === "Load-testing new endpoints")!;
    expect(lt.question).toBe("Beacon thinks Platform can help with load-testing new endpoints. Right?");
    expect(lt.why).toMatch(/^Learned from 2 answers, most recently Lena Fischer's answer\. Waiting for one teammate to confirm because it says what Platform can take on\.$/);
    // Nobody outside the team is asked, or sees pending claims.
    expect(await pendingQuestions(db, await v("priya"), PLATFORM)).toEqual([]);
  });

  it("shows at most three", async () => {
    for (const n of [1, 2, 3, 4]) {
      await learnFrom(db, { unitId: PLATFORM, kind: "answer", ref: `rq_cap_${n}`, label: "An answer", text: `We can help with capacity review number ${n} for new teams.`, offline: true });
    }
    expect((await pendingQuestions(db, await v("ken"), PLATFORM)).length).toBe(PENDING_SHOWN);
  });

  it("one yes makes the claim active on the team page", async () => {
    const ken = await v("ken");
    const [q] = await pendingQuestions(db, ken, PLATFORM);
    await confirmEntry(db, ken, q.id);
    const { active } = await teamContext(db, await v("priya"), PLATFORM);
    expect(active.some((e) => e.id === q.id)).toBe(true);
    expect((await pendingQuestions(db, ken, PLATFORM)).some((x) => x.id === q.id)).toBe(false);
  });

  it("no removes it; not sure only stops asking that person", async () => {
    const [a, b] = await pendingQuestions(db, await v("ken"), PLATFORM);
    await retireEntry(db, await v("ken"), a.id);
    await unsureEntry(db, await v("ken"), b.id);
    expect((await pendingQuestions(db, await v("ken"), PLATFORM)).map((q) => q.id)).not.toContain(b.id);
    expect((await pendingQuestions(db, await v("lena"), PLATFORM)).map((q) => q.id)).toEqual([b.id]);
  });

  it("rides along in each member's batch of asks", async () => {
    await sendBatch(db, await v("lena"));
    const d = (await db.one(`select * from delivery where recipient_id = $1 and kind = 'ask_batch' order by created_at desc limit 1`, [sid("lena")]))!;
    expect(d.body).toContain("Beacon would like a quick check");
    expect(d.body).toContain("Beacon thinks Platform can help with load-testing new endpoints. Right?");
  });
});
