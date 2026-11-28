// T-21: the asker rates the agent's answer. A thumbs down lowers confidence in the learned context
// it used; changing a vote moves it back; only the asker can rate; every vote is audited.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { askTeam } from "@/lib/agent";
import { listAgents } from "@/lib/agents";
import { myVote, rateAnswer } from "@/lib/feedback";
import { conversation, sendChat } from "@/lib/assistant";
import { sid } from "./helpers";

describe("answer feedback", () => {
  let db: Db;
  const v = async (who: string): Promise<Viewer> => (await loadViewer(db, sid(who), "software"))!;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  async function asked() {
    const priya = await v("priya");
    const { questionId } = await askTeam(db, priya, sid("platform"), "How do I load-test a new endpoint?");
    const q = (await db.one(`select * from question where id = $1`, [questionId]))!;
    const ids = (q.source_refs as string[]).filter((r) => r.startsWith("context:")).map((r) => r.slice(8));
    expect(ids.length).toBeGreaterThan(0);
    const conf = async () => {
      const rows = await db.query(`select id, confidence::float as c from context_entry where id = any($1) and provenance = 'learned'`, [ids]);
      return Object.fromEntries(rows.map((r) => [r.id, Number(r.c)]));
    };
    return { priya, questionId, conf };
  }

  it("a thumbs down lowers confidence once, and switching to up restores it plus a little", async () => {
    const { priya, questionId, conf } = await asked();
    const before = await conf();
    expect(Object.keys(before).length).toBeGreaterThan(0);
    await rateAnswer(db, priya, questionId, "down", "It's the old harness.");
    const down = await conf();
    for (const id of Object.keys(before)) expect(down[id]).toBeCloseTo(Math.max(0.1, before[id] - 0.2), 5);
    // Voting the same way again doesn't count twice.
    await rateAnswer(db, priya, questionId, "down");
    expect(await conf()).toEqual(down);
    await rateAnswer(db, priya, questionId, "up");
    const up = await conf();
    for (const id of Object.keys(before)) expect(up[id]).toBeCloseTo(Math.min(0.95, Math.max(0.1, before[id] - 0.2) + 0.25), 5);
    expect(await myVote(db, priya, questionId)).toEqual({ vote: "up", note: "" });
    const audits = await db.query(`select detail from audit_event where action = 'answer_feedback' and target_id = $1 order by at, id`, [questionId]);
    expect(audits.length).toBe(3);
    expect(audits[0].detail.note).toBe("It's the old harness.");
  });

  it("only the person who asked can rate", async () => {
    const { questionId } = await asked();
    await expect(rateAnswer(db, await v("ken"), questionId, "down")).rejects.toThrow(/Only the person who asked/);
  });

  it("chat answers carry the question so they can be rated, and show your vote", async () => {
    const priya = await v("priya");
    const team = (await listAgents(db)).find((x) => x.builtIn && x.team.id === sid("platform"))!;
    await sendChat(db, priya, { target: team.id, text: "How do I load-test a new endpoint?" });
    let msgs = await conversation(db, priya, team.id);
    const ans = msgs.find((m) => m.answer?.questionId);
    expect(ans).toBeDefined();
    if (!ans) return;
    expect(ans.answer!.vote).toBeNull();
    await rateAnswer(db, priya, ans.answer!.questionId!, "up");
    msgs = await conversation(db, priya, team.id);
    expect(msgs.find((m) => m.id === ans.id)!.answer!.vote).toBe("up");
  });
});
