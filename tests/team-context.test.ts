// T-15: the team page's "What Beacon knows" section. Members see sources and correct entries;
// everyone else reads active entries at their level; every correction is audited and sticks.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { PermissionError } from "@/lib/permissions";
import { learnFrom } from "@/lib/context-learn";
import { sid } from "./helpers";
import { confirmEntry, editEntry, restoreEntry, retireEntry, teamContext } from "@/lib/context";

describe("what Beacon knows about a team", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;
  const PLATFORM = sid("platform");
  const entry = async (kind: string) => (await db.one(`select * from context_entry where unit_id = $2 and kind = $1`, [kind, PLATFORM]))!;
  const pr = { unitId: PLATFORM, kind: "pr" as const, ref: "platform/deploy#120", label: "PR #120 in platform/deploy", repo: "platform/deploy", text: "Cache build layers." };

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    await learnFrom(db, pr);
    await learnFrom(db, { unitId: PLATFORM, kind: "answer", ref: "rq_1", label: "Lena's answer", question: "How do I load-test a new endpoint?", text: "Use the k6 harness. We own the staging cluster." });
  });

  it("members see every active entry with its sources; others see the claim without sources, and nothing pending", async () => {
    const mine = await teamContext(db, await v("aisha"), PLATFORM);
    expect(mine.isMember).toBe(true);
    const runs = mine.active.find((e) => e.kind === "system")!;
    expect(runs.tag).toBe("seen");
    expect(runs.origin).toMatch(/^Seen in GitHub: PR #120 in platform\/deploy/);
    expect(runs.sources).toHaveLength(1);
    expect(mine.active.some((e) => e.kind === "responsibility")).toBe(false); // pending: a question, not an entry

    const theirs = await teamContext(db, await v("priya"), PLATFORM);
    expect(theirs.isMember).toBe(false);
    const seen = theirs.active.find((e) => e.kind === "system")!;
    expect(seen.sources).toBeUndefined();
    expect(seen.origin).not.toContain("PR #120");
    expect(seen.canEdit).toBe(false);
    expect(theirs.removed).toEqual([]);
  });

  it("only the team can correct its context", async () => {
    const id = (await entry("system")).id;
    const priya = await v("priya");
    await expect(confirmEntry(db, priya, id)).rejects.toBeInstanceOf(PermissionError);
    await expect(editEntry(db, priya, id, { title: "x", body: "" })).rejects.toBeInstanceOf(PermissionError);
    await expect(retireEntry(db, priya, id)).rejects.toBeInstanceOf(PermissionError);
  });

  it("Looks right and Fix make an entry the team's, and later learning never overwrites a fix", async () => {
    const aisha = await v("aisha");
    const knows = await entry("knows");
    await confirmEntry(db, aisha, knows.id);
    expect((await entry("knows")).provenance).toBe("team_confirmed");

    const sys = await entry("system");
    await editEntry(db, aisha, sys.id, { title: "platform/deploy", body: "The deploy pipeline for every service." });
    await learnFrom(db, { ...pr, ref: "platform/deploy#121", text: "Parallel shards." });
    const after = await entry("system");
    expect(after.provenance).toBe("team_edited");
    expect(after.body).toBe("The deploy pipeline for every service.");
    const view = (await teamContext(db, aisha, PLATFORM)).active.find((e) => e.id === sys.id)!;
    expect(view.tag).toBe("confirmed");
    expect(view.origin).toMatch(/^Fixed by Aisha/);

    const actions = (await db.query(`select action from audit_event where target_kind = 'context_entry' order by at`)).map((r) => r.action);
    expect(actions).toEqual(["context_confirm", "context_edit"]);
  });

  it("Remove hides an entry from everyone, stops it being re-learned, and Undo brings it back", async () => {
    const aisha = await v("aisha");
    const sys = await entry("system");
    await retireEntry(db, aisha, sys.id);
    expect((await teamContext(db, await v("priya"), PLATFORM)).active.some((e) => e.id === sys.id)).toBe(false);
    const mine = await teamContext(db, aisha, PLATFORM);
    expect(mine.active.some((e) => e.id === sys.id)).toBe(false);
    expect(mine.removed.map((e) => e.id)).toEqual([sys.id]);

    await learnFrom(db, { ...pr, ref: "platform/deploy#122" });
    expect((await entry("system")).status).toBe("retired");

    await restoreEntry(db, aisha, sys.id);
    expect((await teamContext(db, await v("priya"), PLATFORM)).active.some((e) => e.id === sys.id)).toBe(true);
  });
});
