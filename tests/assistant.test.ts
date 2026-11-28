// The agent panel and agent teammates, for every demo: your own agent finds the right team, answers
// with sources at your level, proposes actions you approve, and a team can create an agent teammate
// and talk to it.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { conversation, decideAction, sendChat } from "@/lib/assistant";
import { createAgent, listAgents } from "@/lib/agents";
import { DEMOS } from "@/lib/demos";

// These tests cover work-performing agents, which are off by default (src/lib/flags.ts).
process.env.BEACON_WORKERS = "on";

for (const pack of DEMOS) {
  describe(`${pack.org.name}: talking to agents`, () => {
    let db: Db;
    const v = async (id: string): Promise<Viewer> => (await loadViewer(db, id))!;
    const c = pack.checks;

    beforeEach(async () => {
      setNow("2026-12-06T09:00:00Z");
      setLLM(new FakeLLM({}));
      db = await openDb({});
      await migrate(db);
      await seed(db, pack.id);
    });

    it("your own agent finds the team that owns the question and routes it", async () => {
      const d = await v(c.route.as);
      await sendChat(db, d, { target: "me", text: c.route.question });
      const msgs = await conversation(db, d, "me");
      expect(msgs).toHaveLength(2);
      const team = pack.teams.find((t) => t.id === c.route.team)!;
      expect(msgs[1].text).toContain(`so I asked its agent`);
      expect(msgs[1].text).toContain(team.name);
      expect(msgs[1].text).toContain("other people");
      // It offers to mark the question urgent; approving notifies the owner now.
      const nudge = msgs[1].actions.find((a) => a.kind === "nudge")!;
      expect(nudge).toBeTruthy();
      await decideAction(db, d, msgs[1].id, nudge.id, true);
      const owner = pack.people.find((p) => p[0] === c.route.owner)!;
      expect((await db.query(`select * from delivery where recipient_id = $1 and kind = 'ask_now'`, [owner[0]])).length).toBeGreaterThanOrEqual(1);
    });

    it("answers with sources when the team has published the answer", async () => {
      const a = await v(c.answer.as);
      const team = (await listAgents(db)).find((x) => x.builtIn && x.team.id === c.answer.team)!;
      await sendChat(db, a, { target: team.id, text: c.answer.question });
      const [, reply] = await conversation(db, a, team.id);
      // The answer comes claim by claim, each with its tag and source (T-19).
      expect(reply.answer!.claims.map((x) => x.text).join(" ")).toContain(c.answer.contains);
      expect(reply.answer!.claims.every((x) => x.tag !== "inference" && !!x.source && !!x.date)).toBe(true);
      expect(reply.refs.length).toBeGreaterThan(0);
    });

    it("tells you what needs your attention", async () => {
      const d = await v(c.feed.as);
      await sendChat(db, d, { target: "me", text: "What changed for me this week?" });
      const [, reply] = await conversation(db, d, "me");
      expect(reply.text).toMatch(/waiting on|new date/);
    });

    it("a team creates an agent teammate, @mentions it and approves its draft", async () => {
      const owner = await v(c.revise.as);
      const t = pack.agentTemplate;
      const conns = pack.connectors.filter((x) => x[1] === t.team).map((x) => x[0]);
      const id = await createAgent(db, owner, { unitId: t.team, name: t.name, purpose: t.purpose, connectorIds: conns.slice(0, 2), actions: t.actions, approval: "outside_team", schedule: "weekly", budget: 40 });
      const agents = await listAgents(db);
      const made = agents.find((a) => a.id === id)!;
      expect(made.team.id).toBe(t.team);
      expect(made.connectorIds).toHaveLength(Math.min(2, conns.length));
      await sendChat(db, owner, { target: "me", text: `@${t.name} draft our weekly update` });
      const msgs = await conversation(db, owner, id);
      expect(msgs).toHaveLength(2);
      const draft = msgs[1].actions.find((a) => a.kind === "draft_update")!;
      expect(draft).toBeTruthy();
      const out = await decideAction(db, owner, msgs[1].id, draft.id, true);
      const task = await db.one(`select * from task_run where id = $1`, [out.taskId]);
      expect(task!.agent_id).toBe(id);
      // Someone on another team can't put it to work.
      const outsider = pack.people.find((p) => p[3] !== t.team && p[3] !== "leadership")!;
      await sendChat(db, await v(outsider[0]), { target: id, text: "draft our weekly update" });
      const [, no] = await conversation(db, await v(outsider[0]), id);
      expect(no.actions).toHaveLength(0);
    });

    it("follows the guide's teammate step: add the demo's Worker and give it its first job", async () => {
      const owner = await v(c.revise.as);
      const t = pack.agentTemplate;
      const conns = pack.connectors.filter((x) => x[1] === t.team).map((x) => x[0]);
      const id = await createAgent(db, owner, { unitId: t.team, name: t.name, purpose: t.purpose, connectorIds: conns, actions: t.actions, approval: "outside_team", schedule: "on_request", budget: 50 });
      expect((await listAgents(db)).find((a) => a.id === id)!.tier).toBe("worker");
      await sendChat(db, owner, { target: id, text: t.firstJob });
      const [, reply] = await conversation(db, owner, id);
      const job = reply.actions[0];
      expect(["review_doc", "code"]).toContain(job.kind);
      const out = await decideAction(db, owner, reply.id, job.id, true);
      const { runTask } = await import("@/lib/work");
      await runTask(db, out.taskId!);
      const task = (await db.one(`select * from task_run where id = $1`, [out.taskId]))!;
      expect(task.status).toBe("done");
      expect(task.result_md.length).toBeGreaterThan(80);
    });

    it("can't add an agent to someone else's team", async () => {
      const outsider = pack.people.find((p) => p[3] !== pack.agentTemplate.team && p[3] !== "leadership")!;
      await expect(createAgent(db, await v(outsider[0]), { unitId: pack.agentTemplate.team, name: "X", purpose: "Y", connectorIds: [], actions: ["research"], approval: "always", schedule: "on_request", budget: 10 })).rejects.toThrow();
    });
  });
}
