// T-27: when several teams match, Beacon lists them and the asker can send to one or more, linked
// as one question in My questions.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { askTeams, MAX_TEAMS_PER_QUESTION } from "@/lib/agent";
import { conversation, pickedTeams, sendChat } from "@/lib/assistant";
import { myQuestions } from "@/lib/requests";
import { sid } from "./helpers";

const Q = "What is the rate limit on the payments API?";

describe("multi-team questions", () => {
  let db: Db;
  const v = async (who: string): Promise<Viewer> => (await loadViewer(db, sid(who), "software"))!;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("lists the close teams with a Both option, and Both asks each team, linked as one question", async () => {
    const priya = await v("priya");
    await sendChat(db, priya, { target: "me", text: Q });
    let msgs = await conversation(db, priya, "me");
    const ask = msgs[msgs.length - 1];
    expect(ask.text).toMatch(/^This could be Payments API or Platform\. Which should I ask\?/);
    expect(ask.answer!.clarify!.options).toEqual(["Payments API", "Platform", "Both"]);

    await sendChat(db, priya, { target: "me", text: "Both", replyTo: ask.id });
    msgs = await conversation(db, priya, "me");
    const replies = msgs.slice(-2);
    expect(replies[0].text).toMatch(/^Thanks\. I asked Payments API and Platform and linked them as one question in My questions\. \*\*Payments API:\*\*/);
    expect(replies[1].text).toMatch(/^\*\*Platform:\*\*/);

    const qs = await db.query(`select unit_id, group_id from question where asker_id = $1 and text = $2`, [priya.user.id, Q]);
    expect(qs.map((q) => q.unit_id).sort()).toEqual([sid("payments"), sid("platform")].sort());
    expect(new Set(qs.map((q) => q.group_id)).size).toBe(1);
    expect(qs[0].group_id).toBeTruthy();

    const mine = (await myQuestions(db, priya)).filter((m) => m.text.includes("rate limit"));
    expect(mine.length).toBe(2);
    const pay = mine.find((m) => m.unitId === sid("payments"))!;
    expect(pay.alsoAsked).toEqual([{ team: "Platform", slug: "platform" }]);
  });

  it("naming one team still asks just that team", async () => {
    const priya = await v("priya");
    await sendChat(db, priya, { target: "me", text: Q });
    const ask = (await conversation(db, priya, "me")).at(-1)!;
    await sendChat(db, priya, { target: "me", text: "Platform", replyTo: ask.id });
    const qs = await db.query(`select unit_id, group_id from question where asker_id = $1 and text = $2`, [priya.user.id, Q]);
    expect(qs.map((q) => q.unit_id)).toEqual([sid("platform")]);
    expect(qs[0].group_id).toBeNull();
  });

  it("reads picks: both, all, several names, one name, or nothing", () => {
    const t = [{ name: "Payments API" }, { name: "Platform" }, { name: "Finance" }];
    expect(pickedTeams(t, "Both", true)).toEqual(t);
    expect(pickedTeams(t, "All 3", true)).toEqual(t);
    expect(pickedTeams(t, "platform and finance", true).map((x) => x.name)).toEqual(["Platform", "Finance"]);
    expect(pickedTeams(t, "platform and finance", false).map((x) => x.name)).toEqual(["Platform"]);
    expect(pickedTeams(t, "pay", true).map((x) => x.name)).toEqual(["Payments API"]);
    expect(pickedTeams(t, "never mind", true)).toEqual([]);
  });

  it("checks the teams: in this workspace, at least one, at most the cap", async () => {
    const priya = await v("priya");
    await expect(askTeams(db, priya, [], Q)).rejects.toThrow(/at least one/);
    await expect(askTeams(db, priya, [sid("platform"), "other__platform"], Q)).rejects.toThrow(/doesn't exist/);
    const many = Array.from({ length: MAX_TEAMS_PER_QUESTION + 1 }, (_, i) => `x${i}`);
    await expect(askTeams(db, priya, many, Q)).rejects.toThrow(/at most/);
    const { groupId } = await askTeams(db, priya, [sid("platform"), sid("finance")], Q);
    const audit = await db.one(`select detail from audit_event where action = 'question_multi_team' and target_id = $1`, [groupId]);
    expect(audit!.detail.teams).toEqual([sid("platform"), sid("finance")]);
  });
});
