// T-35: every model call is recorded against its workspace, and a workspace that reaches its
// monthly budget gets the offline writer instead of the model, with a note saying why.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { getLLM, setLLM, usage } from "@/lib/ai/llm";
import { withAiScope } from "@/lib/ai/scope";
import { canSetBudget, capResetsAt, costUsd, monthSpend, recordUsage, setMonthlyCap } from "@/lib/ai/spend";

describe("AI spend per workspace", () => {
  let db: Db;
  const env = { ...process.env };

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  afterEach(() => {
    process.env = { ...env };
    setLLM(null);
  });

  it("prices calls at list price and sums this month only", async () => {
    expect(costUsd(1_000_000, 0)).toBe(4);
    expect(costUsd(0, 1_000_000)).toBe(20);
    await recordUsage(db, { orgId: "software", task: "answer_question", inputTokens: 500_000, outputTokens: 100_000 });
    setNow("2026-11-20T09:00:00Z");
    await recordUsage(db, { orgId: "software", task: "answer_question", inputTokens: 1_000_000, outputTokens: 0 });
    setNow("2026-12-06T09:00:00Z");
    const s = await monthSpend(db, "software");
    expect(s.usd).toBeCloseTo(4, 5); // $2 input + $2 output this month; November's call doesn't count
    expect(s.calls).toBe(1);
    expect(s.cap).toBeNull();
    expect(s.capped).toBe(false);
  });

  it("stops calling the model once the workspace reaches its cap, and says why", async () => {
    await setMonthlyCap(db, "software", 3);
    await recordUsage(db, { orgId: "software", task: "answer_question", inputTokens: 500_000, outputTokens: 100_000 });
    expect((await monthSpend(db, "software")).capped).toBe(true);

    // A real Claude adapter, but over budget it returns before any network call.
    process.env.RELAY_LLM_PROVIDER = "claude";
    process.env.ANTHROPIC_API_KEY = "sk-test-not-used";
    setLLM(null);
    const out = await withAiScope({ db, orgId: "software" }, () => getLLM().json("answer_question", { system: "", prompt: "", schema: {} }));
    expect(out).toBeNull();
    expect(usage.lastError).toMatch(/monthly AI budget of \$3/);
    expect(usage.lastError).toContain(capResetsAt().toISOString().slice(0, 10));
    expect(capResetsAt().toISOString().slice(0, 10)).toBe("2027-01-01");
  });

  it("raising or clearing the cap lifts it", async () => {
    await setMonthlyCap(db, "software", 3);
    await recordUsage(db, { orgId: "software", task: "x", inputTokens: 1_000_000, outputTokens: 0 });
    expect((await monthSpend(db, "software")).capped).toBe(true);
    await setMonthlyCap(db, "software", 10);
    expect((await monthSpend(db, "software")).capped).toBe(false);
    await setMonthlyCap(db, "software", null);
    expect((await monthSpend(db, "software")).cap).toBeNull();
  });

  it("only a signed-in owner or admin of a real workspace can set it", async () => {
    expect(await canSetBudget(db, null, "software", false)).toBe(false);
    expect(await canSetBudget(db, "acct_anyone", "software", true)).toBe(false);
  });
});
