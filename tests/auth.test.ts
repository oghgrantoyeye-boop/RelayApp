// T-31: accounts, sessions, magic links and workspace membership — no real OAuth or email.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { upsertAccount, createSession, accountFromSession, ensureMembership, membershipsFor, destroySession } from "@/lib/auth/accounts";
import { requestMagicLink, consumeMagicLink } from "@/lib/auth/magic";
import { listWorkspaceChoices } from "@/lib/auth/workspaces";
import { makeOAuthState, readOAuthState } from "@/lib/auth/oauth";
import { loadViewer, newId } from "@/lib/data";

async function approve(db: Db, email: string) {
  await db.query(`insert into lead (id, email, status, source) values ($1, $2, 'approved', 'test')`, [newId("ld"), email]);
}

describe("sign-in", () => {
  let db: Db;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    process.env.AUTH_SECRET = "test-secret";
    delete process.env.EMAIL_SERVER;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.BEACON_ADMIN_EMAILS;
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("creates an account and session from a magic link", async () => {
    await approve(db, "ava@example.com");
    const { devLink } = await requestMagicLink(db, "ava@example.com");
    expect(devLink).toContain("/api/auth/magic/verify?token=");
    const token = new URL(devLink!).searchParams.get("token")!;
    const { sessionToken } = await consumeMagicLink(db, token);
    const account = await accountFromSession(db, sessionToken);
    expect(account?.email).toBe("ava@example.com");
    await destroySession(db, sessionToken);
    expect(await accountFromSession(db, sessionToken)).toBeNull();
  });

  it("lets one account join several workspaces without mixing people", async () => {
    await approve(db, "lead@example.com");
    const account = await upsertAccount(db, { email: "lead@example.com", name: "Lead" });
    // Second workspace with its own Platform team id.
    await db.query(`insert into org (id, name, settings) values ('acme', 'Acme', '{}')`);
    await db.query(
      `insert into unit (id, org_id, slug, name, description, color) values ('acme_platform', 'acme', 'platform', 'Platform', '', '#1d4ed8')`,
    );
    const m1 = await ensureMembership(db, account.id, "software", { name: "Lead", email: "lead@example.com", role: "member" });
    const m2 = await ensureMembership(db, account.id, "acme", { name: "Lead", email: "lead@example.com", role: "owner" });
    expect(m1.org_id).toBe("software");
    expect(m2.org_id).toBe("acme");
    expect(m1.user_id).not.toBe(m2.user_id);

    const list = await membershipsFor(db, account.id);
    expect(list.map((x) => x.org_id).sort()).toEqual(["acme", "software"]);

    const v1 = await loadViewer(db, m1.user_id, "software");
    const v2 = await loadViewer(db, m2.user_id, "acme");
    expect(v1?.orgId).toBe("software");
    expect(v2?.orgId).toBe("acme");
    expect(await loadViewer(db, m1.user_id, "acme")).toBeNull();
  });

  it("lists sample workspaces for anyone and member workspaces when signed in", async () => {
    const anonymous = await listWorkspaceChoices(db, null);
    expect(anonymous.mine).toEqual([]);
    expect(anonymous.samples.some((s) => s.id === "software")).toBe(true);

    await approve(db, "owner@acme.test");
    const account = await upsertAccount(db, { email: "owner@acme.test", name: "Owner" });
    await db.query(`insert into org (id, name, settings) values ('acme', 'Acme Corp', '{}')`);
    await ensureMembership(db, account.id, "acme", { name: "Owner", email: "owner@acme.test", role: "owner" });
    const signedIn = await listWorkspaceChoices(db, account.id);
    expect(signedIn.mine.map((m) => m.id)).toEqual(["acme"]);
    expect(signedIn.samples.length).toBeGreaterThan(0);
  });

  it("signs and verifies OAuth state", () => {
    const state = makeOAuthState("/signin");
    expect(readOAuthState(state).next).toBe("/signin");
    expect(() => readOAuthState("tampered")).toThrow();
  });

  it("reuses an account when the same Google sub signs in again", async () => {
    await approve(db, "a@x.com");
    const a = await upsertAccount(db, { email: "a@x.com", name: "A", googleSub: "g-1" });
    const { token } = await createSession(db, a.id);
    expect((await accountFromSession(db, token))?.id).toBe(a.id);
    const again = await upsertAccount(db, { email: "a@x.com", name: "Ava", googleSub: "g-1" });
    expect(again.id).toBe(a.id);
    expect(again.name).toBe("Ava");
  });
});
