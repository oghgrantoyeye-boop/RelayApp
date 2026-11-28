// Your Beacon agent holds a conversation: greetings, "what can you do?", a new workspace, and
// anything no team covers. Tests use FakeLLM and never call a real model.
import { beforeAll, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { setNow } from "@/lib/clock";
import { seed } from "@/lib/seed";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { upsertAccount } from "@/lib/auth/accounts";
import { createWorkspace } from "@/lib/auth/workspace-setup";
import { loadViewer, newId, type Viewer } from "@/lib/data";
import { sendChat } from "@/lib/assistant";
import { DEFAULT_DEMO, getDemo } from "@/lib/demos";
import { scoped } from "@/lib/scoped";

describe("talking to your Beacon agent", () => {
  let db: Db;
  let solo: Viewer;
  let ava: Viewer;
  const lastReply = async (v: Viewer) =>
    (await db.one(`select text, refs from chat_message where user_id = $1 and role = 'agent' order by created_at desc limit 1`, [v.user.id]))!;
  const questions = async () => (await db.one(`select count(*)::int as n from question`))!.n as number;

  beforeAll(async () => {
    setNow("2026-12-06T09:00:00Z");
    delete process.env.BEACON_ADMIN_EMAILS;
    setLLM(new FakeLLM());
    db = await openDb({});
    await migrate(db);
    await seed(db, DEFAULT_DEMO);
    await db.query(`insert into lead (id, email, status, source) values ($1, $2, 'approved', 'test')`, [newId("ld"), "solo@acme.test"]);
    const acct = await upsertAccount(db, { email: "solo@acme.test", name: "Sam Solo" });
    const ws = await createWorkspace(db, acct, { name: "Acme Solo", firstTeam: "General" });
    solo = (await loadViewer(db, ws.userId, ws.orgId))!;
    ava = (await loadViewer(db, scoped(DEFAULT_DEMO, getDemo(DEFAULT_DEMO).defaultPersona), DEFAULT_DEMO))!;
  });

  it("answers hello in a new workspace with what it does and how to set up", async () => {
    const before = await questions();
    await sendChat(db, solo, { target: "me", text: "Hello" });
    const r = await lastReply(solo);
    expect(r.text).toMatch(/^Hi Sam\. I'm your Beacon agent/);
    expect(r.text).toContain("Your workspace is new");
    expect(r.text).not.toContain("couldn't tell which team");
    expect(JSON.stringify(r.refs)).toContain("/connect");
    expect(await questions()).toBe(before);
  });

  it("explains itself when asked what it can do, naming teams to ask", async () => {
    await sendChat(db, ava, { target: "me", text: "what can you do?" });
    const r = await lastReply(ava);
    expect(r.text).toMatch(/^I'm your Beacon agent/);
    expect(r.text).toContain("What changed for me this week?");
  });

  it("doesn't send a greeting to a team's queue", async () => {
    const before = await questions();
    await sendChat(db, ava, { target: `agent_${scoped(DEFAULT_DEMO, "platform")}`, text: "hey!" });
    expect((await lastReply(ava)).text).toContain("Platform agent");
    expect(await questions()).toBe(before);
  });

  it("hands anything no team covers to the model when there is one", async () => {
    const fake = new FakeLLM({ chat_reply: { reply: "Paris. I couldn't find anything about that in your workspace." } });
    setLLM(fake);
    await sendChat(db, solo, { target: "me", text: "What's the capital of France?" });
    expect((await lastReply(solo)).text).toBe("Paris. I couldn't find anything about that in your workspace.");
    expect(fake.calls.find((c) => c.task === "chat_reply")?.req.system).toContain("Never invent facts");
    setLLM(new FakeLLM());
  });

  it("without a model, says what to try instead of a dead end", async () => {
    await sendChat(db, solo, { target: "me", text: "What's the capital of France?" });
    const r = await lastReply(solo);
    expect(r.text).toContain("connect GitHub or Claude Code");
    expect(r.text).not.toContain("couldn't tell which team");
  });
});
