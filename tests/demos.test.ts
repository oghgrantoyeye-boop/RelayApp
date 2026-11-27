// Every demo organization tells its story through the same product: these checks run the
// walkthrough's key steps against each demo pack (see src/lib/demos), with a fake model.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { getFeed } from "@/lib/feed";
import { teamCommitments } from "@/lib/commitments";
import { analyzeUpdate, getDraft, publishDraft } from "@/lib/updates";
import { buildDigest } from "@/lib/digest";
import { askTeam, getAsks, getQuestion } from "@/lib/agent";
import { search } from "@/lib/directory";
import { DEMOS } from "@/lib/demos";
import { activeDemo } from "@/lib/demo";

for (const pack of DEMOS) {
  describe(`${pack.org.name} demo`, () => {
    let db: Db;
    const v = async (id: string): Promise<Viewer> => {
      const viewer = await loadViewer(db, id);
      if (!viewer) throw new Error(`No person ${id} in ${pack.org.name}`);
      return viewer;
    };
    const c = pack.checks;

    beforeEach(async () => {
      setNow("2026-12-06T09:00:00Z");
      setLLM(new FakeLLM({ team_headline: { paragraph: "Fixed paragraph from the fake model." } }));
      db = await openDb({});
      await migrate(db);
      await seed(db, pack.id);
    });

    it("loads as the active demo, with every guide persona and link target present", async () => {
      expect((await activeDemo(db)).id).toBe(pack.id);
      await v(pack.defaultPersona);
      for (const step of pack.guide) await v(step.as);
      const teams = new Set(pack.teams.map((t) => t.id));
      for (const step of pack.guide) {
        const m = step.href.match(/^\/(teams|agents)\/([^/#?]+)/);
        if (m) expect(teams.has(m[2])).toBe(true);
        const mt = step.href.match(/^\/meetings\/([^/#?]+)/);
        if (mt) expect(pack.meetings.some((x) => x[0] === mt[1])).toBe(true);
      }
    });

    it(`1. searching "${c.search.q}" finds who owns it`, async () => {
      const r = await search(db, c.search.q);
      expect(r.teams[0].team.id).toBe(c.search.team);
      expect(r.teams[0].why).toBe(`Owns ${c.search.owns}`);
    });

    it("2. the feed shows the upstream decision and flags the downstream deadline at risk", async () => {
      const feed = await getFeed(db, await v(c.feed.as));
      expect(feed.decisions.map((d) => d.id)).toContain(c.feed.decision);
      expect(feed.alerts.find((a) => a.id === c.feed.atRisk)?.state).toBe("at_risk");
    });

    it("3. the waiting team sees the upstream commitment as slipped, with the reason", async () => {
      const { owedTo } = await teamCommitments(db, await v(c.slipped.as), c.slipped.team);
      const com = owedTo.find((x) => x.id === c.slipped.commitment)!;
      expect(com.state).toBe("slipped");
      expect(com.shown.reason).toContain(c.slipped.reason);
    });

    it("4. the upstream lead's example notes revise the commitment and notify the teams waiting", async () => {
      const lead = await v(c.revise.as);
      const { updateId } = await analyzeUpdate(db, lead, { unitId: c.revise.team, source: "meeting", text: pack.ui.writeExamples[c.revise.team] });
      const draft = (await getDraft(db, lead, updateId))!;
      expect(draft.items.length).toBeGreaterThanOrEqual(3);
      const revision = draft.commitments.find((x) => x.revises_id === c.revise.commitment);
      expect(revision?.due_date).toBe(c.revise.due);
      await publishDraft(db, lead, updateId, {
        items: draft.items.map((i) => ({ id: i.id, include: true, kind: i.kind, text: i.text, summary: i.summary_text, headline: i.headline_text, affected: i.affected_unit_ids })),
        commitments: draft.commitments.map((x) => ({ id: x.id, confirm: true, title: x.title, due_date: x.due_date })),
      });
      expect((await db.one(`select due_date from commitment where id = $1`, [c.revise.commitment]))!.due_date).toBe(c.revise.due);
      for (const who of c.revise.notify) {
        expect((await db.query(`select * from delivery where recipient_id = $1 and kind = 'commitment_alert'`, [who])).length).toBe(1);
      }
    });

    it("5. the digest lists slipped commitments and shows the confidential paragraph only to those allowed", async () => {
      const d = await buildDigest(db, (await v(c.digest.allowed)).reader);
      expect(d.slipped.map((s) => s.id)).toEqual(expect.arrayContaining(c.digest.slipped));
      expect(d.paragraphs.some((p) => p.markingIds.includes(c.digest.marking))).toBe(true);
      const other = await buildDigest(db, (await v(c.digest.denied)).reader);
      expect(other.paragraphs.some((p) => p.markingIds.includes(c.digest.marking))).toBe(false);
    });

    it("6. the agent routes the repeated question to its owner and merges it with the others", async () => {
      const asker = await v(c.route.as);
      const { questionId } = await askTeam(db, asker, c.route.team, c.route.question);
      const q = (await getQuestion(db, asker, questionId))!;
      expect(q.question.outcome).toBe("routed");
      const req = (await db.one(`select * from request where id = $1`, [q.question.request_id]))!;
      expect(req.assignee_member_id).toBe(`m_${c.route.owner}_${c.route.team}`);
      expect(req.cluster_key).toBe(c.route.cluster);
      const asks = await getAsks(db, await v(c.route.owner));
      expect(asks.clusters[0].key).toBe(c.route.cluster);
      expect(asks.clusters[0].askers).toHaveLength(c.route.askers);
    });

    it("6b. the agent answers from what a team published", async () => {
      const asker = await v(c.answer.as);
      const { questionId } = await askTeam(db, asker, c.answer.team, c.answer.question);
      const q = (await getQuestion(db, asker, questionId))!;
      expect(q.question.outcome).toBe("answered");
      expect(q.question.answer_text).toContain(c.answer.contains);
      expect(q.sources.map((s) => s.ref)).toContain(c.answer.source);
    });

    it("never leaks the confidential subject to someone outside the marking", async () => {
      const asker = await v(c.leak.as);
      const { questionId } = await askTeam(db, asker, c.leak.team, c.leak.question);
      const q = await getQuestion(db, asker, questionId);
      if (!q) return; // The answer drew on a marked item, so it carries the marking and is withheld.
      expect(JSON.stringify(q.sources)).not.toContain(c.leak.secret);
      expect(q.question.answer_text).not.toContain(c.leak.secret);
    });

    it("every team agent, connector, meeting attendee and commitment owner exists", async () => {
      const people = new Set(pack.people.map((p) => p[0]));
      const teams = new Set(pack.teams.map((t) => t.id));
      for (const m of pack.meetings) for (const a of m[6]) expect(people.has(a), `${m[0]} attendee ${a}`).toBe(true);
      for (const m of pack.meetings) for (const a of m[10]?.action_items ?? []) expect(people.has(a.owner), `${m[0]} owner ${a.owner}`).toBe(true);
      for (const [team, items] of Object.entries(pack.items)) {
        expect(teams.has(team)).toBe(true);
        for (const [, , affected] of items) for (const a of affected) expect(teams.has(a), `${team} affects ${a}`).toBe(true);
      }
      for (const s of pack.story) for (const a of s[6]) expect(teams.has(a), `${s[8]} affects ${a}`).toBe(true);
      for (const f of Object.values(pack.follows)) for (const t of f) expect(teams.has(t)).toBe(true);
    });
  });
}
