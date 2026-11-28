// The brief's permission tests and demo steps, run against a fresh Northwind Labs database.
// A fake model returns fixed text, so these tests never call a real model.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadPolicy, loadViewer, refRequest, refUpdateItem, type Viewer } from "@/lib/data";
import { PermissionError, visibleLevel, rank, type Reader } from "@/lib/permissions";
import { showRequest, showUpdateItem } from "@/lib/render";
import { getFeed } from "@/lib/feed";
import { commitmentViews, confirmCommitment, markDone, teamCommitments } from "@/lib/commitments";
import { analyzeUpdate, getDraft, publishDraft } from "@/lib/updates";
import { buildDigest, sendLeadershipDigest } from "@/lib/digest";
import { answerCluster, askTeam, getAsks, getQuestion } from "@/lib/agent";
import { search } from "@/lib/directory";
import { ingestCodingSession, scrub } from "@/lib/sources";

let db: Db;
let fake: FakeLLM;
const v = async (id: string): Promise<Viewer> => (await loadViewer(db, id))!;

beforeEach(async () => {
  setNow("2026-12-06T09:00:00Z");
  fake = new FakeLLM({ team_headline: { paragraph: "Fixed paragraph from the fake model." } });
  setLLM(fake);
  db = await openDb({});
  await migrate(db);
  await seed(db);
});

async function levelOf(userId: string, table: "update_item" | "request", id: string) {
  const viewer = await v(userId);
  const policy = await loadPolicy(db, viewer.orgId);
  const row = (await db.one(`select * from ${table} where id = $1`, [id]))!;
  const ref = table === "update_item" ? refUpdateItem(row) : refRequest(row);
  return { level: visibleLevel(policy, viewer.reader, ref).level, row };
}

describe("permission tests from the brief", () => {
  it("Growth marketing follows Payments API and sees its decisions at Summary, not full detail", async () => {
    const { level, row } = await levelOf("jordan", "update_item", "ui_retries_decision");
    expect(level).toBe("summary");
    expect(showUpdateItem(row, level)!.text).toBe("Webhook retries ship Dec 12, on by default for every account.");
    expect(showUpdateItem(row, level)!.text).not.toContain("exponential backoff");
  });

  it("A team that doesn't follow Payments API sees only its Headline", async () => {
    const { level, row } = await levelOf("nora", "update_item", "ui_retries_decision"); // Product design
    expect(level).toBe("headline");
    expect(showUpdateItem(row, level)!.text).toBe("Webhook retries planned for Dec 12.");
  });

  it("Only Leadership and Sales see the enterprise customer's name; Payments API sees it redacted", async () => {
    const names = { from: "Sales", to: "Payments API" };
    for (const who of ["elena", "liam"]) {
      const { level, row } = await levelOf(who, "request", "rq_halcyon");
      expect(level).toBe("full");
      expect(showRequest(row, level, names)!.title).toContain("Halcyon Bank");
    }
    const pay = await levelOf("diego", "request", "rq_halcyon");
    expect(pay.level).toBe("summary");
    const shown = showRequest(pay.row, pay.level, names)!;
    expect(shown.title).toBe("Custom rate limits for an enterprise customer before a January pilot");
    expect(JSON.stringify(shown)).not.toContain("Halcyon");
    const mobile = await levelOf("ben", "request", "rq_halcyon");
    expect(rank(mobile.level)).toBeLessThanOrEqual(rank("headline"));
    expect(JSON.stringify(showRequest(mobile.row, mobile.level, names))).not.toContain("Halcyon");
    // Diego's batched asks show the same redacted version.
    const asks = await getAsks(db, await v("diego"));
    const c = asks.clusters.find((x) => x.key === "ck_halcyon")!;
    expect(c.title).not.toContain("Halcyon");
    expect(c.restricted).toBe("Confidential: Leadership and Sales only");
  });

  it("A leadership digest built from the confidential request is itself marked confidential", async () => {
    const leadership = await buildDigest(db, (await v("elena")).reader);
    const sales = leadership.paragraphs.find((p) => p.team.id === "sales")!;
    expect(sales.markingIds).toContain("mk_conf");
    expect(fake.calls.some((c) => c.task === "team_headline" && c.req.prompt.includes("Halcyon"))).toBe(true);

    fake.calls = [];
    const payments = await buildDigest(db, (await v("diego")).reader);
    expect(payments.paragraphs.find((p) => p.team.id === "sales")).toBeUndefined();
    expect(payments.hidden).toBeGreaterThan(0);
    // Built only from what Payments may see: the customer's name never reaches the model.
    expect(fake.calls.some((c) => c.req.prompt.includes("Halcyon"))).toBe(false);
  });

  it("Only Platform members can edit Platform's page, updates and commitments", async () => {
    const diego = await v("diego");
    await expect(analyzeUpdate(db, diego, { unitId: "platform", text: "We'll ship it by Dec 9." })).rejects.toBeInstanceOf(PermissionError);
    await expect(markDone(db, diego, "cm_limits")).rejects.toBeInstanceOf(PermissionError);
    await expect(markDone(db, await v("ken"), "cm_limits")).resolves.toBeUndefined();
  });

  it("An AI-found commitment stays a draft, visible only to its owner, until the owner confirms it", async () => {
    const zoe = await v("zoe");
    const { updateId } = await analyzeUpdate(db, zoe, { unitId: "platform", text: "We'll finish the scheduler migration by Dec 18." });
    const draft = (await getDraft(db, zoe, updateId))!;
    expect(draft.commitments).toHaveLength(1);
    const id = draft.commitments[0].id;
    const seen = async (who: string) => (await commitmentViews(db, (await v(who)).reader, (r) => r.id === id)).length;
    expect(await seen("zoe")).toBe(1);
    expect(await seen("marcus")).toBe(0); // her own lead can't see it yet
    expect(await seen("elena")).toBe(0);
    await expect(confirmCommitment(db, await v("ken"), id)).rejects.toBeInstanceOf(PermissionError);
    await confirmCommitment(db, zoe, id);
    expect(await seen("marcus")).toBe(1);
  });

  it("Every feed read and digest send writes an audit event", async () => {
    const before = (await db.one(`select count(*)::int n from audit_event where action in ('read_feed', 'digest_send')`))!.n;
    await getFeed(db, await v("jordan"));
    await sendLeadershipDigest(db, await v("sam"));
    const feedReads = await db.query(`select * from audit_event where action = 'read_feed'`);
    const sends = await db.query(`select * from audit_event where action = 'digest_send'`);
    expect(feedReads).toHaveLength(1);
    expect(feedReads[0].actor_id).toBe("jordan");
    expect(sends.length).toBeGreaterThanOrEqual(4); // one per Leadership member
    expect(before).toBe(0);
  });
});

describe("team agents and requests", () => {
  it("reads with the asker's access and logs both the agent and the asker", async () => {
    const jordan = await v("jordan");
    await askTeam(db, jordan, "payments", "Will webhook retries cover payout events?");
    const ev = (await db.one(`select * from audit_event where action = 'agent_read' order by id desc limit 1`))!;
    expect(ev.actor_id).toBe("agent_payments");
    expect(ev.on_behalf_of_id).toBe("jordan");
    const policy = await loadPolicy(db, jordan.orgId);
    for (const [ref, level] of Object.entries(ev.detail.levels as Record<string, string>)) {
      if (!ref.startsWith("update_item:")) continue;
      const row = (await db.one(`select * from update_item where id = $1`, [ref.split(":")[1]]))!;
      expect(rank(level as never)).toBeLessThanOrEqual(rank(visibleLevel(policy, jordan.reader, refUpdateItem(row)).level));
    }
  });

  it("answers from what the team published, and the answer carries its sources", async () => {
    const grace = await v("grace");
    const { questionId } = await askTeam(db, grace, "payments", "Do webhook retries cover payout events?");
    const q = (await getQuestion(db, grace, questionId))!;
    expect(q.question.outcome).toBe("answered");
    expect(q.question.answer_text).toContain("January");
    expect(q.sources.map((s) => s.ref)).toContain("update_item:ui_answer_payouts");
    expect(await getQuestion(db, await v("jordan"), questionId)).toBeNull(); // private to the asker
  });

  it("never leaks a marked detail to someone outside the marking", async () => {
    const ben = await v("ben"); // Mobile
    const { questionId } = await askTeam(db, ben, "payments", "Is Payments API giving Halcyon Bank custom rate limits?");
    const q = (await getQuestion(db, ben, questionId))!;
    expect(q.question.answer_text).not.toContain("Halcyon Bank (");
    expect(JSON.stringify(q.sources)).not.toContain("Halcyon");
  });

  it("routes what it can't answer to the owner and merges it with the same question from others", async () => {
    const ravi = await v("ravi");
    const { questionId } = await askTeam(db, ravi, "platform", "When will the rate-limit change land?");
    const q = (await getQuestion(db, ravi, questionId))!;
    expect(q.question.outcome).toBe("routed");
    expect(q.question.answer_text).toContain("Aisha Bello");
    expect(q.question.answer_text).toContain("3 other people");
    const req = (await db.one(`select * from request where id = $1`, [q.question.request_id]))!;
    expect(req.assignee_member_id).toBe("m_aisha_platform");
    expect(req.cluster_key).toBe("ck_limits_date");
    expect(req.delivery).toBe("batch");
    const asks = await getAsks(db, await v("aisha"));
    expect(asks.clusters[0].key).toBe("ck_limits_date");
    expect(asks.clusters[0].askers).toHaveLength(4);
  });

  it("delivers a blocking ask right away instead of waiting for the batch", async () => {
    await askTeam(db, await v("chloe"), "platform", "Can Platform rotate the website's SSO certificate today?", { blocking: true });
    const d = await db.query(`select * from delivery where recipient_id = 'ken' and kind = 'ask_now'`);
    expect(d).toHaveLength(1);
  });

  it("answers once for everyone, keeps it private unless published, then answers it next time", async () => {
    const aisha = await v("aisha");
    const r = await answerCluster(db, aisha, "ck_limits_date", { answer: "The leak fix merged. We'll land the change by Dec 9.", publish: true, publishLevel: "summary" });
    expect(r.recipients).toBe(3);
    for (const who of ["hannah", "maya", "grace"]) {
      expect((await db.query(`select * from delivery where recipient_id = $1 and kind = 'answer'`, [who])).length).toBe(1);
    }
    const item = (await db.one(`select * from update_item where id = $1`, [r.publishedId]))!;
    expect(item.max_level).toBe("summary");
    // Payments follows Platform at full detail, but the publisher capped this answer at Summary.
    expect((await levelOf("hannah", "update_item", item.id)).level).toBe("summary");
    const { questionId } = await askTeam(db, await v("ravi"), "platform", "When will the rate-limit change land?");
    const q = (await getQuestion(db, await v("ravi"), questionId))!;
    expect(q.question.outcome).toBe("answered");
  });
});

describe("demo steps", () => {
  it("1. searching 'rate limits' lands on Platform", async () => {
    const r = await search(db, "rate limits");
    expect(r.teams[0].team.id).toBe("platform");
    expect(r.teams[0].why).toBe("Owns Rate limits");
  });

  it("2. Growth marketing's feed shows the retries decision and flags the Dec 15 launch at risk", async () => {
    const feed = await getFeed(db, await v("jordan"));
    expect(feed.decisions.map((d) => d.id)).toContain("ui_retries_decision");
    const launch = feed.alerts.find((a) => a.id === "cm_launch")!;
    expect(launch.state).toBe("at_risk");
  });

  it("3. Payments API sees Platform's Dec 5 commitment as slipped, with the latest reason", async () => {
    const { owedTo } = await teamCommitments(db, await v("priya"), "payments");
    const c = owedTo.find((x) => x.id === "cm_limits")!;
    expect(c.state).toBe("slipped");
    expect(c.shown.reason).toContain("memory leak");
  });

  it("4. Platform's notes revise the commitment to Dec 9 and notify Payments API and Growth marketing", async () => {
    const marcus = await v("marcus");
    const { updateId } = await analyzeUpdate(db, marcus, {
      unitId: "platform",
      source: "meeting",
      text: "Platform sync notes\n- The limiter memory leak fix is merged and load tests are stable.\n- We'll land the rate-limit change by Dec 9.\n- SSO for the mobile admin app is on track.",
    });
    const draft = (await getDraft(db, marcus, updateId))!;
    expect(draft.items.length).toBeGreaterThanOrEqual(3);
    const revision = draft.commitments.find((c) => c.revises_id === "cm_limits")!;
    expect(revision.due_date).toBe("2026-12-09");
    await publishDraft(db, marcus, updateId, {
      items: draft.items.map((i) => ({ id: i.id, include: true, kind: i.kind, text: i.text, summary: i.summary_text, headline: i.headline_text, affected: i.affected_unit_ids })),
      commitments: draft.commitments.map((c) => ({ id: c.id, confirm: true, title: c.title, due_date: c.due_date })),
    });
    const limits = (await db.one(`select * from commitment where id = 'cm_limits'`))!;
    expect(limits.due_date).toBe("2026-12-09");
    for (const who of ["priya", "jordan"]) {
      expect((await db.query(`select * from delivery where recipient_id = $1 and kind = 'commitment_alert'`, [who])).length).toBe(1);
    }
    const { owedTo } = await teamCommitments(db, await v("priya"), "payments");
    expect(owedTo.find((x) => x.id === "cm_limits")!.state).toBe("on_track");
  });

  it("5. the leadership digest lists slipped commitments and shows the confidential paragraph only to those allowed", async () => {
    const d = await buildDigest(db, (await v("elena")).reader);
    expect(d.slipped.map((s) => s.id)).toEqual(expect.arrayContaining(["cm_limits", "cm_budget"]));
    expect(d.paragraphs.some((p) => p.markingIds.includes("mk_conf"))).toBe(true);
    const growth = await buildDigest(db, (await v("jordan")).reader);
    expect(growth.paragraphs.some((p) => p.markingIds.includes("mk_conf"))).toBe(false);
  });
});

describe("draft sources", () => {
  it("turns a coding session into a draft only its author can see, with secrets removed", async () => {
    const hannah = await v("hannah");
    const { updateId } = await ingestCodingSession(db, hannah, {
      repo: "northwind/payments-api",
      branch: "feat/retries",
      prompts: ["Add backoff to retries, key is sk_live_abcdefghijklmnop"],
      notes: ["Retry scheduler done. Blocked on Platform's burst limits."],
      commits: ["abc1234 Add retry scheduler"],
      diffstat: "3 files changed",
    });
    const items = await db.query(`select * from update_item where update_id = $1`, [updateId]);
    expect(items.every((i) => i.status === "draft")).toBe(true);
    expect(JSON.stringify(items)).not.toContain("sk_live");
    const diego = await v("diego");
    const policy = await loadPolicy(db, diego.orgId);
    const teammate: Reader = diego.reader;
    expect(visibleLevel(policy, teammate, refUpdateItem(items[0])).level).toBe("none");
    expect(scrub("token=abc123 and ghp_123456789012345")).not.toMatch(/abc123|ghp_1234/);
  });
});
