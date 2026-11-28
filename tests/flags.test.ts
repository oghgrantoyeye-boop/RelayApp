// With BEACON_WORKERS off (the default), work-performing agents are deferred: no jobs are offered
// or started, worker teammates can't be created, and the guide skips pages that are hidden.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { conversation, sendChat } from "@/lib/assistant";
import { createAgent, listAgents } from "@/lib/agents";
import { startTask } from "@/lib/work";
import { activeDemo } from "@/lib/demo";
import { getDemo } from "@/lib/demos";
import { workersEnabled, WORKERS_OFF_MESSAGE } from "@/lib/flags";

delete process.env.BEACON_WORKERS;

describe("work-performing agents are off by default", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, id))!;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("reads the flag at call time", () => {
    expect(workersEnabled()).toBe(false);
    process.env.BEACON_WORKERS = "on";
    expect(workersEnabled()).toBe(true);
    delete process.env.BEACON_WORKERS;
  });

  it("the agent says it can't do work instead of offering a job", async () => {
    const marcus = await v("marcus");
    await sendChat(db, marcus, { target: "me", text: "Draft our weekly update" });
    const msgs = await conversation(db, marcus, "me");
    const reply = msgs[msgs.length - 1];
    expect(reply.text).toContain(WORKERS_OFF_MESSAGE);
    expect(reply.actions).toEqual([]);
  });

  it("questions still get answered or routed", async () => {
    const ravi = await v("ravi");
    await sendChat(db, ravi, { target: "me", text: "When will the rate-limit change land?" });
    const msgs = await conversation(db, ravi, "me");
    expect(msgs[msgs.length - 1].text).not.toContain(WORKERS_OFF_MESSAGE);
  });

  it("tasks can't start and worker teammates can't be created", async () => {
    const marcus = await v("marcus");
    await expect(startTask(db, marcus, "platform", { kind: "draft_update", instructions: "" })).rejects.toThrow(WORKERS_OFF_MESSAGE);
    await expect(
      createAgent(db, marcus, { unitId: "platform", name: "Coder", purpose: "Fix bugs", connectorIds: [], actions: ["code"], approval: "outside_team", schedule: "on_request", budget: 20 }),
    ).rejects.toThrow(WORKERS_OFF_MESSAGE);
    const qa = await createAgent(db, marcus, { unitId: "platform", name: "Front desk", purpose: "Answer questions", connectorIds: [], actions: ["answer"], approval: "outside_team", schedule: "on_request", budget: 20 });
    expect((await listAgents(db)).some((a) => a.id === qa)).toBe(true);
  });

  it("the demo guide skips hidden pages", async () => {
    const pack = await activeDemo(db);
    const hidden = [/^\/digest/, /^\/map/, /^\/agents\/new/, /\/tasks\//];
    expect([...pack.guide, ...pack.explore].some((s) => hidden.some((r) => r.test(s.href)))).toBe(false);
    expect(pack.guide.length).toBeLessThan(getDemo("software").guide.length);
  });
});
