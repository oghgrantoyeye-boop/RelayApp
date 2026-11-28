// Team context entries and signals (T-10): the team reads its own context in full, other teams see
// active entries at their shared level with no sources, markings cap it, and pending, retired and
// raw signals never leave the team.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { now, setNow } from "@/lib/clock";
import { loadPolicy, loadViewer, refContext, refSignal, type Viewer } from "@/lib/data";
import { visibleLevel } from "@/lib/permissions";
import { showContext } from "@/lib/render";
import { scoped } from "@/lib/scoped";

const ORG = "software";
const sid = (id: string) => scoped(ORG, id);

describe("team context visibility", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), ORG))!;
  const entry = async (id: string, f: { status?: string; shared?: string; markings?: string[] } = {}) => {
    await db.query(
      `insert into context_entry (id, unit_id, kind, title, body, provenance, source_refs, shared_level, marking_ids, status, first_seen_at, last_seen_at, updated_at)
       values ($1, $8, 'knows', $2, 'Lena has run it for Payments.', 'learned', $3, $4, $5, $6, $7, $7, $7)`,
      [
        id,
        `Entry ${id}`,
        JSON.stringify([{ kind: "answer", ref: "rq_1", label: "Lena's answer", at: "2026-11-26" }]),
        f.shared ?? "summary",
        (f.markings ?? []).map(sid),
        f.status ?? "active",
        now(),
        sid("platform"),
      ],
    );
    return (await db.one(`select * from context_entry where id = $1`, [id]))!;
  };
  const level = async (who: string, row: Record<string, unknown>, ref = refContext) => {
    const viewer = await v(who);
    return visibleLevel(await loadPolicy(db, viewer.orgId), viewer.reader, ref(row)).level;
  };

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    db = await openDb({});
    await migrate(db);
    await seed(db, ORG);
  });

  it("fills org_id from the team", async () => {
    const row = await entry("ce_org");
    expect(row.org_id).toBe((await v("aisha")).orgId);
  });

  it("members read it in full with sources; others get the shared level without sources", async () => {
    const row = await entry("ce_a");
    expect(await level("aisha", row)).toBe("full");
    expect(showContext(row, "full")!.sources).toHaveLength(1);
    expect(await level("priya", row)).toBe("summary");
    const shown = showContext(row, "summary")!;
    expect(shown.body).toBe("Lena has run it for Payments.");
    expect(shown.sources).toBeUndefined();
  });

  it("a headline entry shows only its title to others", async () => {
    const row = await entry("ce_h", { shared: "headline" });
    expect(await level("priya", row)).toBe("headline");
    const shown = showContext(row, "headline")!;
    expect(shown.title).toBe("Entry ce_h");
    expect(shown.body).toBeUndefined();
  });

  it("pending and retired entries stay inside the team", async () => {
    for (const status of ["pending", "retired"]) {
      const row = await entry(`ce_${status}`, { status });
      expect(await level("aisha", row)).toBe("full");
      expect(await level("priya", row)).toBe("none");
    }
  });

  it("an entry learned from a marked source is capped by the marking", async () => {
    const row = await entry("ce_m", { shared: "full", markings: ["mk_conf"] });
    expect(await level("priya", row)).toBe("summary"); // mk_conf lets others see Summary
    expect(await level("elena", row)).toBe("full"); // Leadership is allowed by the marking
  });

  it("raw signals never leave the team", async () => {
    await db.query(
      `insert into context_signal (id, unit_id, source_kind, source_ref, claim, at) values ('cs_1', $2, 'agent_chat', 'msg_1', '{"kind":"knows","title":"x"}', $1)`,
      [now(), sid("platform")],
    );
    const row = (await db.one(`select * from context_signal where id = 'cs_1'`))!;
    expect(row.org_id).toBe((await v("aisha")).orgId);
    expect(await level("aisha", row, refSignal)).toBe("full");
    expect(await level("priya", row, refSignal)).toBe("none");
    expect(await level("elena", row, refSignal)).toBe("none");
  });
});
