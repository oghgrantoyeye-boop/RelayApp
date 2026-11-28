// T-25: what the asker sees of a request, every transition, and the audit trail for each.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { PermissionError } from "@/lib/permissions";
import { answerCluster, askForDetail, askTeam, claimCluster, declineCluster } from "@/lib/agent";
import { askAgain, businessDaysBetween, replyWithDetail, requestState, resolveRequest, sendToLead, sweepUnresolved } from "@/lib/requests";
import { sid } from "./helpers";

const SSO = "Can Platform support single sign-on for the merchant admin console?";

describe("request lifecycle", () => {
  let db: Db;
  let id: string;
  const v = async (who: string): Promise<Viewer> => (await loadViewer(db, sid(who), "software"))!;
  const PLATFORM = sid("platform");
  const row = async () => (await db.one(`select * from request where id = $1`, [id]))!;
  const state = async () => requestState(await row());
  const trail = async () =>
    (await db.query(`select actor_id, detail from audit_event where action = 'request_status' and target_id = $1 order by id`, [id])).map((e) => `${e.detail.from}>${e.detail.to}`);
  const inbox = async (who: string, kind: string) => db.query(`select * from delivery where recipient_id = $1 and kind = $2`, [sid(who), kind]);

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z"); // a Sunday
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [] } }));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    const { questionId } = await askTeam(db, await v("priya"), PLATFORM, SSO);
    id = (await db.one(`select request_id from question where id = $1`, [questionId]))!.request_id;
  });

  it("counts whole weekdays", () => {
    const fri = new Date("2026-12-04T09:00:00Z");
    expect(businessDaysBetween(fri, new Date("2026-12-07T09:00:00Z"))).toBe(1); // Mon
    expect(businessDaysBetween(fri, new Date("2026-12-09T08:59:00Z"))).toBe(2);
    expect(businessDaysBetween(fri, new Date("2026-12-09T09:00:00Z"))).toBe(3);
  });

  it("awaiting the team, answered, then resolved by the asker", async () => {
    expect(await state()).toBe("awaiting_team");
    await answerCluster(db, await v("ken"), id, { answer: "Not for merchants yet, roughly 3 weeks of work." });
    expect(await state()).toBe("answered");
    await expect(resolveRequest(db, await v("ken"), id)).rejects.toBeInstanceOf(PermissionError);
    await resolveRequest(db, await v("priya"), id);
    expect(await state()).toBe("resolved");
    expect(await trail()).toEqual(["awaiting_team>answered", "answered>resolved"]);
  });

  it("needs your input until the asker replies, and the reply reaches whoever asked for it", async () => {
    await askForDetail(db, await v("ken"), id, "Which identity providers do merchants use?");
    expect(await state()).toBe("needs_info");
    await replyWithDetail(db, await v("priya"), id, "Mostly Okta and Azure AD.");
    expect(await state()).toBe("awaiting_team");
    expect((await inbox("ken", "request_update")).some((d) => d.body.includes("Okta"))).toBe(true);
    await expect(replyWithDetail(db, await v("priya"), id, "Again")).rejects.toThrow(/isn't waiting on you/);
    expect(await trail()).toEqual(["awaiting_team>needs_info", "needs_info>awaiting_team"]);
  });

  it("declined", async () => {
    await declineCluster(db, await v("ken"), id, "Out of scope this quarter.");
    expect(await state()).toBe("declined");
    expect(await trail()).toEqual(["awaiting_team>declined"]);
  });

  it("goes unresolved after 3 business days, tells the asker once, and can go to the lead", async () => {
    setNow("2026-12-09T08:59:00Z");
    expect(await sweepUnresolved(db, "software")).not.toContain(id);
    setNow("2026-12-09T09:01:00Z");
    expect(await sweepUnresolved(db, "software")).toContain(id);
    expect(await state()).toBe("unresolved");
    expect(await sweepUnresolved(db, "software")).toEqual([]);
    expect(await inbox("priya", "request_unresolved")).toHaveLength(1);

    const { lead } = await sendToLead(db, await v("priya"), id);
    expect(lead).toBe("Marcus Johnson");
    const r = await row();
    expect(requestState(r)).toBe("awaiting_team");
    expect(r.destination).toBe("owner");
    expect(r.route_reason).toMatch(/Platform's lead/);
    expect((await inbox("marcus", "request_update")).some((d) => d.body.includes("single sign-on"))).toBe(true);
    // The clock restarts from the escalation.
    setNow("2026-12-11T09:01:00Z");
    expect(await sweepUnresolved(db, "software")).not.toContain(id);
    expect(await trail()).toEqual(["awaiting_team>unresolved", "unresolved>awaiting_team"]);
  });

  it("ask again reminds whoever picked it up and restarts the clock", async () => {
    await claimCluster(db, await v("ken"), id);
    setNow("2026-12-10T09:00:00Z");
    await sweepUnresolved(db, "software");
    await expect(askAgain(db, await v("ken"), id)).rejects.toBeInstanceOf(PermissionError);
    await askAgain(db, await v("priya"), id);
    expect(await state()).toBe("awaiting_team");
    expect((await inbox("ken", "request_update")).some((d) => d.subject.includes("asking again"))).toBe(true);
    await expect(askAgain(db, await v("priya"), id)).rejects.toThrow(/once it has gone unanswered/);
  });

  it("doesn't go unresolved while the team waits on the asker", async () => {
    await askForDetail(db, await v("ken"), id, "Which identity providers?");
    setNow("2026-12-16T09:00:00Z");
    expect(await sweepUnresolved(db, "software")).not.toContain(id);
    expect(await state()).toBe("needs_info");
  });
});
