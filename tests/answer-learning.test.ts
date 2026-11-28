// T-24: an answer is private to the askers, and Beacon learns the general fact from it instead of
// anyone ticking Publish. The answerer sees what was learned and can confirm, fix or drop it.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { answerCluster } from "@/lib/agent";
import { confirmEntry, learnedFromAnswer, retireEntry } from "@/lib/context";
import { sid } from "./helpers";

let db: Db;
const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;

beforeEach(async () => {
  setNow("2026-12-06T09:00:00Z");
  setLLM(new FakeLLM({}));
  db = await openDb({});
  await migrate(db);
  await seed(db);
});

describe("answers feed learning", () => {
  it("keeps the answer private and shows the answerer what Beacon learned", async () => {
    const r = await answerCluster(db, await v("aisha"), "ck_limits_date", { answer: "The leak fix merged. We'll land the change by Dec 9." });
    expect(await db.query(`select id from update_item where source_kind = 'answer'`)).toHaveLength(0);
    const shown = (await learnedFromAnswer(db, await v("aisha"), r.requestId))!;
    expect(shown.team).toBe("Platform");
    expect(shown.entries.map((e) => e.id).sort()).toEqual([...r.learned].sort());
    const fact = shown.entries.find((e) => e.kind === "knows")!;
    expect(fact.body).toContain("Dec 9");
    expect(fact.status).toBe("active");
    expect(fact.why).toBeNull();
  });

  it("holds what a team can take on for a teammate, who can confirm it from the queue", async () => {
    const r = await answerCluster(db, await v("aisha"), "ck_limits_date", {
      answer: "We'll land the change by Dec 9. We can help with load-testing new endpoints before launch.",
    });
    const shown = (await learnedFromAnswer(db, await v("ken"), r.requestId))!;
    const cap = shown.entries.find((e) => e.kind === "capability")!;
    expect(cap.status).toBe("pending");
    expect(cap.why).toContain("what Platform can take on");
    await confirmEntry(db, await v("ken"), cap.id);
    const after = (await learnedFromAnswer(db, await v("ken"), r.requestId))!.entries.find((e) => e.id === cap.id)!;
    expect(after.status).toBe("active");
    expect(after.confirmed).toBe(true);
  });

  it("drops what the team says not to keep, and never shows it outside the team", async () => {
    const r = await answerCluster(db, await v("aisha"), "ck_limits_date", { answer: "We'll land the change by Dec 9." });
    expect(await learnedFromAnswer(db, await v("hannah"), r.requestId)).toBeNull();
    for (const id of r.learned) await retireEntry(db, await v("aisha"), id);
    const shown = (await learnedFromAnswer(db, await v("aisha"), r.requestId))!;
    expect(shown.entries.every((e) => e.status === "retired")).toBe(true);
  });
});
