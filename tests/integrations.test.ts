// Integrations, meetings and agent work: the same permission rules, applied to connected tools.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadPolicy, loadViewer, refSource, type Viewer } from "@/lib/data";
import { PermissionError, visibleLevel } from "@/lib/permissions";
import { showSource } from "@/lib/render";
import { askTeam } from "@/lib/agent";
import { getMeeting, listMeetings, routeMeeting, summarizeMeeting } from "@/lib/meetings";
import { commentTask, getTask, listTasks, redirectTask, runTask, startTask, takeOverTask } from "@/lib/work";
import { commitmentViews } from "@/lib/commitments";
import { getDraft, publishDraft } from "@/lib/updates";
import { recentSourceItems } from "@/lib/integrations";

// These tests cover work-performing agents, which are off by default (src/lib/flags.ts).
process.env.BEACON_WORKERS = "on";

let db: Db;
const v = async (id: string): Promise<Viewer> => (await loadViewer(db, id))!;

beforeEach(async () => {
  setNow("2026-12-06T09:00:00Z");
  setLLM(new FakeLLM());
  db = await openDb({});
  await migrate(db);
  await seed(db);
});

async function sourceLevel(userId: string, title: string) {
  const row = (await db.one(`select * from source_doc where title = $1`, [title]))!;
  const viewer = await v(userId);
  const level = visibleLevel(await loadPolicy(db, viewer.orgId), viewer.reader, refSource(row)).level;
  return { level, shown: showSource(row, level) };
}

describe("connected tools", () => {
  it("never lets raw chat leave the team", async () => {
    expect((await sourceLevel("aisha", "Marcus Johnson in #platform-eng")).shown?.text).toContain("Tentatively Dec 9");
    expect((await sourceLevel("priya", "Marcus Johnson in #platform-eng")).shown).toBeNull();
    expect((await sourceLevel("elena", "Marcus Johnson in #platform-eng")).shown).toBeNull();
  });

  it("shares tickets only where an interface says so", async () => {
    const pay = await sourceLevel("priya", "Per-merchant burst limits");
    expect(pay.level).toBe("full"); // Platform shares tickets with Payments API at full detail
    expect(pay.shown?.status).toBe("In review");
    expect((await sourceLevel("ben", "Per-merchant burst limits")).shown).toBeNull(); // Mobile gets only headlines
  });

  it("keeps marked tool content inside the marking", async () => {
    // Payments owns the ticket, but the marking caps it below full detail, and tool content has no redacted version.
    const diego = await sourceLevel("diego", "Per-account limit overrides for Halcyon Bank");
    expect(diego.level).toBe("summary");
    expect(diego.shown).toBeNull();
    // Mobile gets Payments' tickets at Summary through an interface, so the title would name the customer: nothing is shown.
    expect((await sourceLevel("ben", "Per-account limit overrides for Halcyon Bank")).shown).toBeNull();
    const items = await recentSourceItems(db, await v("hannah"), "payments", 50);
    expect(items.some((i) => i.row.external_ref === "PAY-320")).toBe(false);
    expect(JSON.stringify(items)).not.toContain("Halcyon");
  });

  it("keeps a team's internal docs private by default", async () => {
    // Growth doesn't follow Platform and no interface shares docs: not even the title.
    expect((await sourceLevel("ravi", "Rate limits runbook")).shown).toBeNull();
    expect((await sourceLevel("lena", "Rate limits runbook")).shown?.text).toContain("200 requests");
  });

  it("lets the agent use a team's tools only at the asker's level", async () => {
    await askTeam(db, await v("ravi"), "platform", "When will the rate-limit change land?");
    const ev = (await db.one(`select * from audit_event where action = 'agent_read' order by id desc limit 1`))!;
    const refs = Object.keys(ev.detail.levels as Record<string, string>);
    expect(refs.some((r) => r.startsWith("source:"))).toBe(false); // Growth sees no Platform tool content
    await askTeam(db, await v("hannah"), "platform", "What's the status of the burst limits ticket?");
    const ev2 = (await db.one(`select * from audit_event where action = 'agent_read' order by id desc limit 1`))!;
    const refs2 = Object.keys(ev2.detail.levels as Record<string, string>).filter((r) => r.startsWith("source:"));
    expect(refs2.length).toBeGreaterThan(0); // Payments sees Platform's tickets and pull requests
    const kinds = await db.query(`select kind from source_doc where id = any($1)`, [refs2.map((r) => r.split(":")[1])]);
    expect(kinds.every((k) => k.kind === "ticket" || k.kind === "pr")).toBe(true);
  });
});

describe("meetings", () => {
  it("shows a meeting to its host team and attendees only", async () => {
    expect(await getMeeting(db, await v("priya"), "mt_limits")).not.toBeNull(); // attended, from Payments
    expect(await getMeeting(db, await v("zoe"), "mt_limits")).not.toBeNull(); // Platform, didn't attend
    expect(await getMeeting(db, await v("ben"), "mt_limits")).toBeNull();
    expect((await listMeetings(db, await v("jordan"))).map((m) => m.id)).toEqual(["mt_launch"]);
    expect(await getMeeting(db, await v("diego"), "mt_staff")).toBeNull(); // confidential staff meeting
  });

  it("summarizes decisions and action items, and routes them as drafts", async () => {
    const marcus = await v("marcus");
    const s = await summarizeMeeting(db, marcus, "mt_limits");
    expect(s.decisions.join(" ")).toContain("keep retries behind the flag");
    expect(s.action_items.map((a) => a.owner).sort()).toEqual(["aisha", "hannah", "marcus"]);
    expect(s.action_items.find((a) => a.owner === "hannah")!.text).toMatch(/throttle retries/i);

    const updateId = await routeMeeting(db, marcus, "mt_limits");
    const draft = (await getDraft(db, marcus, updateId))!;
    expect(draft.items.some((i) => i.kind === "decision" && (i.affected_unit_ids as string[]).includes("payments"))).toBe(true);
    const hannahs = draft.commitments.find((c) => c.owner_user_id === "hannah")!;
    expect(hannahs.owner_unit_id).toBe("payments");
    const seen = async (who: string) => (await commitmentViews(db, (await v(who)).reader, (r) => r.id === hannahs.id)).length;
    expect(await seen("hannah")).toBe(1);
    expect(await seen("marcus")).toBe(0);
    await expect(routeMeeting(db, await v("priya"), "mt_limits")).rejects.toBeInstanceOf(PermissionError);

    // Publishing confirms Marcus's own action item and leaves Hannah's for her.
    await publishDraft(db, marcus, updateId, {
      items: draft.items.map((i) => ({ id: i.id, include: true, kind: i.kind, text: i.text, summary: i.summary_text, headline: i.headline_text, affected: i.affected_unit_ids })),
      commitments: draft.commitments.map((c) => ({ id: c.id, confirm: true, title: c.title, due_date: c.due_date })),
    });
    const statuses = await db.query(`select c.status, om.user_id from commitment c join member om on om.id = c.owner_member_id where c.update_id = $1`, [updateId]);
    expect(statuses.find((r) => r.user_id === "marcus")!.status).toBe("open");
    expect(statuses.find((r) => r.user_id === "hannah")!.status).toBe("draft");
  });
});

describe("agent work", () => {
  it("is shared with the team and nobody else", async () => {
    const id = await startTask(db, await v("hannah"), "payments", { kind: "research", instructions: "How do other APIs cap webhook retry rates?" });
    expect(await getTask(db, await v("diego"), id)).not.toBeNull();
    expect(await getTask(db, await v("aisha"), id)).toBeNull();
    expect(await listTasks(db, await v("aisha"), "payments")).toEqual([]);
    await expect(startTask(db, await v("aisha"), "payments", { kind: "research", instructions: "x" })).rejects.toBeInstanceOf(PermissionError);
  });

  it("asks for a key instead of pretending to research without one", async () => {
    const id = await startTask(db, await v("hannah"), "payments", { kind: "research", instructions: "Compare webhook retry policies" });
    await runTask(db, id);
    const t = (await getTask(db, await v("hannah"), id))!.task;
    expect(t.status).toBe("needs_key");
    expect(t.result_md).toBeNull();
  });

  it("researches with the model, tracks cost and logs both agent and requester", async () => {
    setLLM(new FakeLLM({}, { text: "## Answer\nCap at the merchant level.", sources: [{ title: "Example", url: "https://example.com" }], inputTokens: 100000, outputTokens: 5000, searches: 3 }));
    const before = Number((await db.one(`select spent_usd from app_user where id = 'agent_payments'`))!.spent_usd);
    const id = await startTask(db, await v("hannah"), "payments", { kind: "research", instructions: "How do other APIs cap webhook retry rates?" });
    await runTask(db, id);
    const t = (await getTask(db, await v("priya"), id))!.task;
    expect(t.status).toBe("done");
    expect(t.result_md).toContain("Cap at the merchant level");
    expect(Number(t.cost_usd)).toBeCloseTo(0.5, 2); // 100k in at $4/M + 5k out at $20/M
    expect(Number((await db.one(`select spent_usd from app_user where id = 'agent_payments'`))!.spent_usd)).toBeCloseTo(before + 0.5, 2);
    const ev = (await db.one(`select * from audit_event where action = 'task_done' and target_id = $1`, [id]))!;
    expect([ev.actor_id, ev.on_behalf_of_id]).toEqual(["agent_payments", "hannah"]);
  });

  it("lets teammates comment, redirect and take over", async () => {
    const id = await startTask(db, await v("hannah"), "payments", { kind: "research", instructions: "Compare webhook retry policies" });
    await commentTask(db, await v("diego"), id, "Include payouts too");
    await redirectTask(db, await v("priya"), id, "Focus on per-merchant caps");
    let t = (await getTask(db, await v("hannah"), id))!.task;
    expect(t.status).toBe("queued");
    expect(t.instructions).toContain("Focus on per-merchant caps");
    await takeOverTask(db, await v("priya"), id);
    t = (await getTask(db, await v("hannah"), id))!.task;
    expect(t.status).toBe("stopped");
    expect(t.taken_over_by).toBe("priya");
  });

  it("drafts the team's update from its tools without a model", async () => {
    const id = await startTask(db, await v("marcus"), "platform", { kind: "draft_update", instructions: "" });
    await runTask(db, id);
    const t = (await getTask(db, await v("marcus"), id))!.task;
    expect(t.status).toBe("done");
    const draft = (await getDraft(db, await v("marcus"), t.output_ref))!;
    expect(draft.update.source).toBe("agent");
    expect(draft.items.length).toBeGreaterThan(2);
    expect(draft.items.every((i) => i.status === "draft")).toBe(true);
  });
});
