// T-22: a question the agent can't answer goes to the owner when ownership clearly matches, and to
// the team queue otherwise. Either way the asker and the team are told why.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { answerCluster, askTeam, chooseRoute, getAsks, getQuestion } from "@/lib/agent";
import { confidentOwnership } from "@/lib/ai/tasks";
import { sid } from "./helpers";

describe("routing to the owner or the team queue", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;
  const PLATFORM = sid("platform");

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    // The agent can't answer from what Platform shared, so every question here gets routed.
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [] } }));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("needs a keyword and a clear winner to call ownership confident", () => {
    const owns = [
      { id: "auth", title: "Auth and SSO", description: "Sign-in, SSO and the identity provider", keywords: ["auth", "sso", "sign-in"] },
      { id: "limits", title: "Rate limits", description: "Per-merchant burst limits", keywords: ["rate", "limits"] },
    ];
    expect(confidentOwnership("Can we raise our rate limits?", owns)).toBe("limits");
    expect(confidentOwnership("Can Platform support single sign-on for the merchant admin console?", owns)).toBeNull();
    expect(confidentOwnership("Auth or rate?", owns)).toBeNull(); // two areas match equally
  });

  it("a team with no lead still gets the ask in its queue; only the lead alert is skipped", async () => {
    await db.query(`update member set role = 'member' where unit_id = $1 and role = 'lead'`, [PLATFORM]);
    const route = await chooseRoute(db, PLATFORM, "Can Platform support single sign-on for the merchant admin console?");
    expect(route).toMatchObject({ destination: "team_queue", lead: null });

    const ava = await v("priya");
    const { questionId } = await askTeam(db, ava, PLATFORM, "Can Platform support single sign-on for the merchant admin console?", { blocking: true });
    const q = (await getQuestion(db, ava, questionId))!;
    expect(q.question.outcome).toBe("routed");
    expect(q.question.answer_text).not.toMatch(/team lead/);
    const req = (await db.one(`select * from request where id = $1`, [q.question.request_id]))!;
    expect(req).toMatchObject({ destination: "team_queue", assignee_member_id: null });
  });

  it("merchant sign-on goes to Platform's queue with the reason, and anyone on Platform sees it", async () => {
    const ava = await v("priya");
    const route = await chooseRoute(db, PLATFORM, "Can Platform support single sign-on for the merchant admin console?");
    expect(route.destination).toBe("team_queue");

    const { questionId } = await askTeam(db, ava, PLATFORM, "Can Platform support single sign-on for the merchant admin console?");
    const q = (await getQuestion(db, ava, questionId))!;
    expect(q.question.outcome).toBe("routed");
    expect(q.question.answer_text).toMatch(/went to the team queue/);
    const req = (await db.one(`select * from request where id = $1`, [q.question.request_id]))!;
    expect(req).toMatchObject({ destination: "team_queue", assignee_member_id: null });
    expect(req.route_reason).toMatch(/^No one on Platform clearly owns this/);

    for (const who of ["ken", "zoe", "marcus"]) {
      const asks = await getAsks(db, await v(who), "team");
      const c = asks.clusters.find((x) => x.requests.some((r) => r.id === req.id));
      expect(c?.destination).toBe("team_queue");
      expect(c?.reason).toBe(req.route_reason);
    }
    const outside = await getAsks(db, await v("grace"), "team");
    expect(outside.clusters.some((x) => x.requests.some((r) => r.id === req.id))).toBe(false);

    // Anyone on the team can answer it once for everyone.
    await answerCluster(db, await v("zoe"), req.cluster_key, { answer: "Not for merchants yet. It's new work." });
    expect((await db.one(`select status from request where id = $1`, [req.id]))!.status).toBe("answered");
  });

  it("a confident match goes to the owner and says so", async () => {
    const { questionId } = await askTeam(db, await v("priya"), PLATFORM, "Can you raise the burst limits on our sandbox quota?");
    const q = (await db.one(`select r.* from question q join request r on r.id = q.request_id where q.id = $1`, [questionId]))!;
    expect(q.destination).toBe("owner");
    expect(q.route_reason).toBe("Sent to Aisha Bello, who owns Rate limits. The rest of Platform can see it too.");
  });

  it("a blocking team-queue ask notifies the lead now", async () => {
    await askTeam(db, await v("priya"), PLATFORM, "Can Platform support single sign-on for the merchant admin console?", { blocking: true });
    const d = await db.query(`select * from delivery where recipient_id = $1 and kind = 'ask_now'`, [sid("marcus")]);
    expect(d).toHaveLength(1);
    expect(d[0].subject).toMatch(/in the Platform queue/);
  });
});
