// The agent chat as a real conversation: history goes to the model every turn, Beacon's abilities
// are tools the model calls, and replies stream. A scripted mock model stands in; tests never call
// a real one.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { openDb, migrate, type Db } from "@/lib/db";
import { setNow } from "@/lib/clock";
import { seed } from "@/lib/seed";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { setChatModel } from "@/lib/ai/chat";
import { upsertAccount } from "@/lib/auth/accounts";
import { createWorkspace } from "@/lib/auth/workspace-setup";
import { loadViewer, newId, type Viewer } from "@/lib/data";
import { sendChat } from "@/lib/assistant";
import { DEFAULT_DEMO, getDemo } from "@/lib/demos";
import { scoped } from "@/lib/scoped";

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };
const textStep = (text: string) => ({
  stream: convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t" },
    ...text.split(/(?<= )/).map((delta) => ({ type: "text-delta", id: "t", delta })),
    { type: "text-end", id: "t" },
    { type: "finish", finishReason: { unified: "stop", raw: "end_turn" }, usage },
  ]),
});
const toolStep = (toolName: string, input: unknown) => ({
  stream: convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: newId("tc"), toolName, input: JSON.stringify(input) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage },
  ]),
});

/** A model that plays the given steps in order and records every call. */
function scripted(steps: { stream: ReadableStream<unknown> }[]) {
  let i = 0;
  const model = new MockLanguageModelV4({
    doStream: async () => steps[Math.min(i++, steps.length - 1)] as never,
  });
  return model;
}

describe("talking to your Beacon agent", () => {
  let db: Db;
  let solo: Viewer;
  let ava: Viewer;
  const lastReply = async (v: Viewer, target = "me") =>
    (await db.one(`select text, refs, answer from chat_message where user_id = $1 and target = $2 and role = 'agent' order by created_at desc limit 1`, [v.user.id, target]))!;
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
  afterAll(() => setChatModel(undefined));

  it("streams a reply, and sends the whole conversation each turn", async () => {
    const model = scripted([textStep("Hi Sam! What are you working on?"), textStep("Nice. Want to connect GitHub so I can follow along?")]);
    setChatModel(model);
    const deltas: string[] = [];
    await sendChat(db, solo, { target: "me", text: "Hello" }, (d) => deltas.push(d));
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toBe("Hi Sam! What are you working on?");
    await sendChat(db, solo, { target: "me", text: "a waste mgmt app" });
    expect((await lastReply(solo)).text).toBe("Nice. Want to connect GitHub so I can follow along?");
    const second = model.doStreamCalls[1];
    const said = JSON.stringify(second.prompt);
    expect(said).toContain("Hello");
    expect(said).toContain("Hi Sam! What are you working on?");
    expect(said).toContain("a waste mgmt app");
    expect(said).toContain("The workspace is new");
  });

  it("shows links only when the model asks for them", async () => {
    setChatModel(scripted([toolStep("show_links", { links: ["connect_tools", "my_team_page"] }), textStep("Start by connecting GitHub.")]));
    await sendChat(db, solo, { target: "me", text: "how do I start?" });
    const r = await lastReply(solo);
    expect(r.text).toBe("Start by connecting GitHub.");
    expect(r.refs.map((x: { label: string }) => x.label)).toEqual(["Connect GitHub or Claude Code", "Your team page"]);
    setChatModel(scripted([textStep("Sure.")]));
    await sendChat(db, solo, { target: "me", text: "ok thanks" });
    expect((await lastReply(solo)).refs).toEqual([]);
  });

  it("a greeting doesn't become a question for any team", async () => {
    const before = await questions();
    setChatModel(scripted([textStep("Hey Ava, what's up?")]));
    await sendChat(db, ava, { target: "me", text: "hey" });
    expect(await questions()).toBe(before);
  });

  it("asks a team through a tool, with the sourced answer saved under the reply", async () => {
    const c = getDemo(DEFAULT_DEMO).checks.answer;
    const grace = (await loadViewer(db, scoped(DEFAULT_DEMO, c.as), DEFAULT_DEMO))!;
    const team = getDemo(DEFAULT_DEMO).teams.find((t) => t.id === c.team)!.name;
    const model = scripted([toolStep("ask_team", { team, question: c.question }), textStep("Yes, according to the team.")]);
    setChatModel(model);
    const before = await questions();
    await sendChat(db, grace, { target: "me", text: c.question.toLowerCase().replace("webhook", "webhok") });
    const r = await lastReply(grace);
    expect(r.text).toBe("Yes, according to the team.");
    expect(await questions()).toBe(before + 1);
    expect(r.answer.claims.length).toBeGreaterThan(0);
    // The model saw the tool's result, not invented facts.
    expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain(c.contains);
  });

  it("can't ask another workspace's team", async () => {
    const model = scripted([toolStep("ask_team", { team: "Platform", question: "When do rate limits change?" }), textStep("There's no Platform team here.")]);
    setChatModel(model);
    const before = await questions();
    await sendChat(db, solo, { target: "me", text: "ask platform about rate limits" });
    expect(await questions()).toBe(before);
    expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain('No team called');
  });

  it("falls back to the fixed replies without a model", async () => {
    setChatModel(null);
    const deltas: string[] = [];
    await sendChat(db, ava, { target: "me", text: "What do we owe other teams?" }, (d) => deltas.push(d));
    expect(deltas.join("")).toMatch(/owe|no open commitments/);
  });
});
