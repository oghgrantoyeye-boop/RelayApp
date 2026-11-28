// T-20: an agent can ask one follow-up before answering or routing, the asker's reply continues the
// question, and your own agent asks which team you mean when two match about equally.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { askTeam, continueQuestion, getQuestion } from "@/lib/agent";
import { conversation, sendChat } from "@/lib/assistant";
import { listAgents } from "@/lib/agents";
import { PermissionError } from "@/lib/permissions";
import { sid } from "./helpers";

const FOLLOW = { question: "Is this for Northwind staff or merchants' own admins?", options: ["Merchants' own admins", "Northwind staff"] };

describe("clarifying questions", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;
  const PLATFORM = sid("platform");
  const Q = "Can Platform support single sign-on for a new admin console?";

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("asks before routing, then the reply continues the question and it isn't asked twice", async () => {
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [], clarify: FOLLOW } }));
    const priya = await v("priya");
    const { questionId } = await askTeam(db, priya, PLATFORM, Q);
    const asked = (await getQuestion(db, priya, questionId))!;
    expect(asked.question.outcome).toBe("clarify");
    expect(asked.clarify).toEqual(FOLLOW);
    expect(await db.one(`select id from request where title = $1`, [Q])).toBeNull(); // nothing routed yet

    const next = await continueQuestion(db, priya, questionId, "Merchants' own admins");
    const after = (await getQuestion(db, priya, next.questionId))!;
    expect(after.question.parent_id).toBe(questionId);
    expect(after.question.outcome).toBe("routed"); // the model still can't answer; this time it routes
    expect(after.clarify).toBeNull();
    const req = (await db.one(`select title from request where id = $1`, [after.question.request_id]))!;
    expect(req.title).toBe(`${Q} (Merchants' own admins)`);
    expect((await getQuestion(db, priya, questionId))!.followUpId).toBe(next.questionId);

    // Replying again returns the same follow-up question instead of asking again.
    expect((await continueQuestion(db, priya, questionId, "Northwind staff")).questionId).toBe(next.questionId);
  });

  it("only the asker can reply", async () => {
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [], clarify: FOLLOW } }));
    const { questionId } = await askTeam(db, await v("priya"), PLATFORM, Q);
    await expect(continueQuestion(db, await v("grace"), questionId, "Northwind staff")).rejects.toBeInstanceOf(PermissionError);
  });

  it("a follow-up needs two suggested replies; one isn't a real choice", async () => {
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [], clarify: { question: "Which one?", options: ["Only this"] } } }));
    const { questionId } = await askTeam(db, await v("priya"), PLATFORM, Q);
    expect((await db.one(`select outcome from question where id = $1`, [questionId]))!.outcome).toBe("routed");
  });

  it("in the agent panel, picking a suggested reply continues the question", async () => {
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [], clarify: FOLLOW } }));
    const priya = await v("priya");
    const agent = (await listAgents(db)).find((a) => a.builtIn && a.team.id === PLATFORM)!;
    await sendChat(db, priya, { target: agent.id, text: Q });
    let msgs = await conversation(db, priya, agent.id);
    const ask = msgs.at(-1)!;
    expect(ask.text).toContain(FOLLOW.question);
    expect(ask.answer?.clarify?.options).toEqual(FOLLOW.options);

    await sendChat(db, priya, { target: agent.id, text: "Merchants' own admins" });
    msgs = await conversation(db, priya, agent.id);
    expect(msgs.find((m) => m.id === ask.id)!.answer!.clarify!.done).toBe(true);
    expect(msgs.at(-1)!.text).toMatch(/^Thanks\./);
    const child = await db.one(`select * from question where parent_id is not null and asker_id = $1`, [priya.user.id]);
    expect(child?.text).toBe(`${Q} (Merchants' own admins)`);
  });

  it("your own agent asks which team you mean when two match, then asks the one you pick", async () => {
    const priya = await v("priya");
    const text = "Who handles webhook retries and rate limits?";
    await sendChat(db, priya, { target: "me", text: text.replace(/^Who handles/, "What about") });
    let msgs = await conversation(db, priya, "me");
    const ask = msgs.at(-1)!;
    expect(ask.text).toMatch(/could be Platform or Payments API/);
    expect(ask.answer!.clarify!.options).toEqual(["Platform", "Payments API"]);

    await sendChat(db, priya, { target: "me", text: "Payments API", replyTo: ask.id });
    msgs = await conversation(db, priya, "me");
    expect(msgs.at(-1)!.text).toMatch(/I asked the Payments API agent/);
    const q = await db.one(`select unit_id from question where asker_id = $1 order by created_at desc limit 1`, [priya.user.id]);
    expect(q!.unit_id).toBe(sid("payments"));
  });
});
