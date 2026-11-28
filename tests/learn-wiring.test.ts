// T-12: answering a routed question and a teammate talking to their own team's agent both teach
// Beacon about the team. Someone from another team talking to that agent does not.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { answerCluster } from "@/lib/agent";
import { sendChat } from "@/lib/assistant";
import { listAgents } from "@/lib/agents";
import { ingestCodingSession, ingestPullRequest } from "@/lib/sources";
import { summarizeMeeting } from "@/lib/meetings";
import { analyzeUpdate, getDraft, publishDraft } from "@/lib/updates";
import { clearLearned, sid } from "./helpers";

describe("learning from answers and agent chats", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    await clearLearned(db);
  });

  it("an answer to a routed question becomes context for the answering team, with the answer as its source", async () => {
    const req = (await db.one(`select * from request where cluster_key = 'ck_limits_date' limit 1`))!;
    await answerCluster(db, await v("aisha"), "ck_limits_date", {
      answer: "We own the rate limiter. The leak fix merged and we'll land the change by Dec 9.",
    });
    const rows = await db.query(`select * from context_entry where unit_id = $1`, [req.to_unit_id]);
    const knows = rows.find((e) => e.kind === "knows");
    expect(knows?.status).toBe("active");
    expect(knows?.source_refs[0]).toMatchObject({ kind: "answer", ref: req.id });
    expect(rows.find((e) => e.kind === "responsibility")?.status).toBe("pending");
  });

  it("learns from a teammate's message to their own team's agent, not from an outsider's", async () => {
    const agents = await listAgents(db);
    const aisha = await v("aisha");
    const own = agents.find((a) => aisha.reader.unitIds.includes(a.team.id))!;
    expect(own).toBeTruthy();
    await sendChat(db, aisha, { target: own.id, text: "For capacity questions, book a review in #platform-asks." });
    const mine = await db.query(`select * from context_signal where unit_id = $1 and source_kind = 'agent_chat'`, [own.team.id]);
    expect(mine.length).toBeGreaterThan(0);

    const outsider = (await db.one(
      `select u.id from app_user u join member m on m.user_id = u.id where u.kind = 'human' and m.unit_id <> $1
       and not exists (select 1 from member m2 where m2.user_id = u.id and m2.unit_id = $1) limit 1`,
      [own.team.id],
    ))!;
    const before = mine.length;
    await sendChat(db, (await loadViewer(db, outsider.id, "software"))!, {
      target: own.id,
      text: "Book a review in #random-place.",
    });
    const after = await db.query(`select * from context_signal where unit_id = $1 and source_kind = 'agent_chat'`, [own.team.id]);
    expect(after).toHaveLength(before);
  });
});

describe("learning from updates, meetings, PRs and coding sessions", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;
  const entries = (unit: string) => db.query(`select * from context_entry where unit_id = $1`, [unit]);

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    await clearLearned(db);
  });

  it("a merged PR in a new repository adds a Runs entry seen in GitHub", async () => {
    const hannah = await v("hannah");
    await db.query(`update app_user set github_login = 'hannah-gh' where id = $1`, [sid("hannah")]);
    const r = await ingestPullRequest(db, {
      action: "closed",
      repository: { full_name: "northwind/ledger-sync" },
      pull_request: { number: 77, merged: true, title: "Retry failed ledger writes", body: "Internal notes stay in the draft.", user: { login: "hannah-gh" } },
    });
    expect("updateId" in r).toBe(true);
    const sys = (await entries(hannah.team.id)).find((e) => e.kind === "system" && /ledger-sync/.test(e.title));
    expect(sys?.status).toBe("active");
    expect(sys?.source_refs[0]).toMatchObject({ kind: "pr", ref: "northwind/ledger-sync#77" });
    const all = JSON.stringify(await entries(hannah.team.id));
    expect(all).not.toContain("Internal notes");
  });

  it("a coding session teaches only which repository the team works in, never the prompts", async () => {
    const hannah = await v("hannah");
    await ingestCodingSession(db, hannah, { repo: "northwind/payments-api", branch: "feat/retries", prompts: ["We own the secret billing migration"], commits: ["abc Add retry"] });
    const rows = await entries(hannah.team.id);
    expect(rows.some((e) => e.kind === "system" && /payments-api/.test(e.title))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("billing migration");
  });

  it("what Beacon learns from a meeting waits for a teammate", async () => {
    const meeting = (await db.one(`select unit_id from meeting where id = $1`, [sid("mt_limits")]))!;
    // The model would find this; the offline extractor finds nothing in this meeting's decisions.
    setLLM(new FakeLLM({ extract_context: { claims: [{ kind: "system", title: "Retry flag", body: "Retries stay behind the flag." }] } }));
    await summarizeMeeting(db, await v("marcus"), sid("mt_limits"));
    const sigs = await db.query(`select * from context_signal where source_kind = 'meeting' and source_ref = $1`, [sid("mt_limits")]);
    expect(sigs.length).toBeGreaterThan(0);
    const fromMeeting = (await entries(meeting.unit_id)).filter((e) => e.source_refs.some((s: { kind: string }) => s.kind === "meeting"));
    expect(fromMeeting.length).toBeGreaterThan(0);
    expect(fromMeeting.every((e) => e.status === "pending")).toBe(true);
  });

  it("a published update teaches Beacon about the team that wrote it", async () => {
    const zoe = await v("zoe");
    const { updateId } = await analyzeUpdate(db, zoe, { unitId: sid("platform"), text: "We own the staging cluster now. Book a review in #platform-asks before load tests." });
    const draft = (await getDraft(db, zoe, updateId))!;
    await publishDraft(db, zoe, updateId, {
      items: draft.items.map((i) => ({ id: i.id, include: true, kind: i.kind, text: i.text, summary: i.summary_text, headline: i.headline_text, affected: i.affected_unit_ids })),
      commitments: [],
    });
    const rows = await entries(sid("platform"));
    expect(rows.some((e) => e.source_refs.some((s: { kind: string; ref: string }) => s.kind === "update" && s.ref === updateId))).toBe(true);
  });
});
