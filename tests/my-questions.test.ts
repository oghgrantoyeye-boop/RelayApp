// T-26: My questions lists what the viewer asked, where it went and why, the progress so far and
// the reply, and only ever the viewer's own questions.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { answerCluster, askTeam, claimCluster } from "@/lib/agent";
import { myQuestions, resolveRequest, sweepUnresolved } from "@/lib/requests";
import { conversation, sendChat } from "@/lib/assistant";
import { listAgents } from "@/lib/agents";
import { sid } from "./helpers";

const SSO = "Can Platform support single sign-on for the merchant admin console?";

describe("My questions", () => {
  let db: Db;
  let id: string;
  const v = async (who: string): Promise<Viewer> => (await loadViewer(db, sid(who), "software"))!;
  const mine = async (who: string) => myQuestions(db, await v(who));

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [] } }));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    const { questionId } = await askTeam(db, await v("priya"), sid("platform"), SSO);
    id = (await db.one(`select request_id from question where id = $1`, [questionId]))!.request_id;
  });

  it("shows where a question went and why, and the steps so far", async () => {
    const q = (await mine("priya")).find((x) => x.key === id)!;
    expect(q.wentTo).toBe("Platform's queue");
    expect(q.why).toMatch(/team queue/);
    expect(q.state).toBe("awaiting_team");
    expect(q.steps.map((s) => s.label)).toEqual(["Asked", "In Platform's queue", "Answered"]);
    expect(q.steps.at(-1)!.done).toBe(false);
    expect(q.reply).toBeNull();
  });

  it("follows it through pick-up, the answer and That answers it", async () => {
    await claimCluster(db, await v("ken"), id);
    await answerCluster(db, await v("ken"), id, { answer: "Not for merchants yet, roughly 3 weeks of work." });
    let q = (await mine("priya")).find((x) => x.key === id)!;
    expect(q.state).toBe("answered");
    expect(q.steps.map((s) => s.label)).toEqual(["Asked", "In Platform's queue", "Ken picked it up", "Answered"]);
    expect(q.reply).toEqual({ by: "Ken Watanabe, Platform", text: "Not for merchants yet, roughly 3 weeks of work." });
    await resolveRequest(db, await v("priya"), id);
    q = (await mine("priya")).find((x) => x.key === id)!;
    expect(q.state).toBe("resolved");
    expect(q.steps.at(-1)!.label).toBe("Resolved");
  });

  it("flags it when no one answers, and lists the newest change first", async () => {
    setNow("2026-12-10T10:00:00Z");
    await sweepUnresolved(db, "software");
    const list = await mine("priya");
    const q = list.find((x) => x.key === id)!;
    expect(q.state).toBe("unresolved");
    expect(q.steps.map((s) => s.label)).toContain("No reply in 3 days");
    for (let i = 1; i < list.length; i++) expect(list[i - 1].lastChange.getTime()).toBeGreaterThanOrEqual(list[i].lastChange.getTime());
  });

  it("only lists the viewer's own questions", async () => {
    expect((await mine("ken")).some((x) => x.key === id)).toBe(false);
  });

  it("a routed chat answer links to the question in My questions", async () => {
    const priya = await v("priya");
    const agent = (await listAgents(db)).find((a) => a.builtIn && a.team.id === sid("platform"))!;
    await sendChat(db, priya, { target: agent.id, text: "Does Platform support SAML for merchant identity providers?" });
    const reply = (await conversation(db, priya, agent.id)).at(-1)!;
    expect(reply.refs.some((x) => x.href.startsWith("/questions?open="))).toBe(true);
  });
});
