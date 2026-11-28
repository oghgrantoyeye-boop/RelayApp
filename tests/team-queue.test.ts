// T-23: the team queue. For you holds what was sent to you or what you picked up; the team queue
// holds everything open for your team. Anyone on the team can pick a question up, pass it on, ask
// the askers for more detail, or answer it once for everyone.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { askForDetail, askTeam, claimCluster, getAsks, passCluster } from "@/lib/agent";
import { PermissionError } from "@/lib/permissions";
import { sid } from "./helpers";

describe("the team queue", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;
  const PLATFORM = sid("platform");
  const SSO = "Can Platform support single sign-on for the merchant admin console?";
  const keyOf = async () => (await db.one(`select cluster_key from request where title = $1`, [SSO]))!.cluster_key as string;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({ answer_question: { answered: false, claims: [], gaps: [] } }));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    await askTeam(db, await v("priya"), PLATFORM, SSO);
  });

  const has = (asks: Awaited<ReturnType<typeof getAsks>>, key: string) => asks.clusters.some((c) => c.key === key);

  it("a team-queue question is in the team queue for everyone on the team, and in nobody's For you", async () => {
    const key = await keyOf();
    for (const who of ["ken", "lena", "marcus"]) {
      expect(has(await getAsks(db, await v(who), "team"), key)).toBe(true);
      expect(has(await getAsks(db, await v(who), "for_you"), key)).toBe(false);
    }
    // A question sent to an owner shows in the owner's For you and in the team queue.
    const owned = (await db.one(`select cluster_key from request where destination = 'owner' and to_unit_id = $1 and status = 'open' limit 1`, [PLATFORM]))!.cluster_key;
    const ownerKey = (await db.one(`select a.id from request r join member m on m.id = r.assignee_member_id join app_user a on a.id = m.user_id where r.cluster_key = $1 limit 1`, [owned]))!.id;
    expect(has(await getAsks(db, (await loadViewer(db, ownerKey, "software"))!, "for_you"), owned)).toBe(true);
    expect(has(await getAsks(db, await v("zoe"), "team"), owned)).toBe(true);
  });

  it("I'll take it moves it to your For you and shows the team who has it", async () => {
    const key = await keyOf();
    await claimCluster(db, await v("ken"), key);
    expect(has(await getAsks(db, await v("ken"), "for_you"), key)).toBe(true);
    const seen = (await getAsks(db, await v("lena"), "team")).clusters.find((c) => c.key === key)!;
    expect(seen.claimedBy?.name).toBe("Ken Watanabe");
    expect((await db.one(`select action from audit_event where action = 'claim_request'`))).toBeTruthy();
  });

  it("passing to a teammate gives it to them and tells them; only people on the team can take it", async () => {
    const key = await keyOf();
    const r = await passCluster(db, await v("ken"), key, sid("lena"), "You set this up for staff.");
    expect(r.to).toBe("Lena Fischer");
    expect(has(await getAsks(db, await v("lena"), "for_you"), key)).toBe(true);
    const d = (await db.one(`select * from delivery where recipient_id = $1 order by created_at desc limit 1`, [sid("lena")]))!;
    expect(d.body).toContain("You set this up for staff.");
    await expect(passCluster(db, await v("ken"), key, sid("priya"))).rejects.toThrow(/not on Platform/);
  });

  it("asking for more detail tells everyone who asked and keeps the question open", async () => {
    const key = await keyOf();
    await askForDetail(db, await v("ken"), key, "Is this for staff or merchants' own admins?");
    const d = (await db.one(`select * from delivery where recipient_id = $1 order by created_at desc limit 1`, [sid("priya")]))!;
    expect(d.subject).toMatch(/needs more detail/);
    const req = (await db.one(`select status, detail_question from request where cluster_key = $1`, [key]))!;
    expect(req).toMatchObject({ status: "open", detail_question: "Is this for staff or merchants' own admins?" });
  });

  it("someone outside the team can't pick it up", async () => {
    const key = await keyOf();
    await expect(claimCluster(db, await v("priya"), key)).rejects.toBeInstanceOf(PermissionError);
  });
});
