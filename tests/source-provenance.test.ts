// T-18: every source an agent answers from says where it came from and when it was last true.
// Active team context is a source; a pending claim never reaches anyone's answer.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { askTeam, publishedSourcesFor } from "@/lib/agent";
import { learnFrom } from "@/lib/context-learn";
import { sid } from "./helpers";

describe("sources carry provenance and freshness", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;
  const PLATFORM = sid("platform");

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("every source has a provenance and a last-seen date", async () => {
    await learnFrom(db, { unitId: PLATFORM, kind: "pr", ref: "platform/deploy#1", label: "PR #1 in platform/deploy", repo: "platform/deploy", text: "Cache layers." });
    const sources = await publishedSourcesFor(db, PLATFORM, await v("priya"));
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) {
      expect(["confirmed", "learned", "seen"]).toContain(s.provenance);
      expect(Number.isNaN(Date.parse(s.lastSeen))).toBe(false);
    }
    const ctx = sources.find((s) => s.ref.startsWith("context:"))!;
    expect(ctx).toMatchObject({ provenance: "seen", label: "Seen in tools" });
    expect(ctx.lastSeen.slice(0, 10)).toBe("2026-12-06");
    expect(sources.filter((s) => s.ref.startsWith("update_item:")).every((s) => s.provenance === "confirmed")).toBe(true);
  });

  it("a pending claim can't appear in another team's answer", async () => {
    await learnFrom(db, { unitId: PLATFORM, kind: "answer", ref: "rq_x", label: "Lena's answer", text: "We own the zebracorn ingestion service." });
    const pending = (await db.one(`select * from context_entry where unit_id = $1 and kind = 'responsibility'`, [PLATFORM]))!;
    expect(pending.status).toBe("pending");

    const priya = await v("priya");
    const sources = await publishedSourcesFor(db, PLATFORM, priya);
    expect(sources.some((s) => s.ref === `context:${pending.id}`)).toBe(false);
    const { questionId } = await askTeam(db, priya, PLATFORM, "Who owns the zebracorn ingestion service?");
    const q = (await db.one(`select * from question where id = $1`, [questionId]))!;
    expect(JSON.stringify(q.source_refs)).not.toContain(pending.id);
    expect(q.answer_text).not.toMatch(/zebracorn/i);

    // Once a teammate confirms it, it's a source like any other.
    await db.query(`update context_entry set status = 'active', provenance = 'team_confirmed', confirmed_at = now() where id = $1`, [pending.id]);
    const after = await publishedSourcesFor(db, PLATFORM, priya);
    expect(after.find((s) => s.ref === `context:${pending.id}`)?.provenance).toBe("confirmed");
  });
});
