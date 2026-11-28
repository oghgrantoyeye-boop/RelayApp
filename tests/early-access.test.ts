// T-36: new accounts need early access; existing accounts and sample workspaces stay open.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { upsertAccount, createSession, accountFromSession, UnverifiedEmailError } from "@/lib/auth/accounts";
import { requestMagicLink, consumeMagicLink } from "@/lib/auth/magic";
import { EarlyAccessError, isAdminEmail, listLeads, setLeadStatus } from "@/lib/auth/early-access";
import { decodeJwtPayload } from "@/lib/auth/oauth";
import { newId } from "@/lib/data";

describe("early access gate", () => {
  let db: Db;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    process.env.AUTH_SECRET = "test-secret";
    process.env.BEACON_ADMIN_EMAILS = "admin@beacon.test";
    delete process.env.EMAIL_SERVER;
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("blocks unapproved emails on magic link, Google and Microsoft sign-in paths", async () => {
    const { devLink } = await requestMagicLink(db, "stranger@example.com");
    const token = new URL(devLink!).searchParams.get("token")!;
    await expect(consumeMagicLink(db, token)).rejects.toBeInstanceOf(EarlyAccessError);
    expect(await db.one(`select status, source from lead where email = 'stranger@example.com'`)).toMatchObject({
      status: "pending",
      source: "signin",
    });
    expect(await db.one(`select id from account where email = 'stranger@example.com'`)).toBeNull();

    await expect(upsertAccount(db, { email: "g@example.com", name: "G", googleSub: "g-new" })).rejects.toBeInstanceOf(EarlyAccessError);
    await expect(upsertAccount(db, { email: "m@example.com", name: "M", microsoftSub: "m-new" })).rejects.toBeInstanceOf(EarlyAccessError);
    expect(await db.query(`select id from account where email in ('g@example.com', 'm@example.com')`)).toHaveLength(0);
  });

  it("creates an account once a lead is approved, and for admin emails", async () => {
    await db.query(`insert into lead (id, email, status, source) values ($1, $2, 'pending', 'form')`, [newId("ld"), "ok@example.com"]);
    await expect(upsertAccount(db, { email: "ok@example.com" })).rejects.toBeInstanceOf(EarlyAccessError);

    const admin = await upsertAccount(db, { email: "admin@beacon.test", name: "Admin" });
    expect(isAdminEmail(admin.email)).toBe(true);
    const lead = (await db.one(`select * from lead where email = 'ok@example.com'`))!;
    await setLeadStatus(db, lead.id, "approved", admin);

    const account = await upsertAccount(db, { email: "ok@example.com", name: "Ok", googleSub: "g-ok" });
    expect(account.email).toBe("ok@example.com");
    const { token } = await createSession(db, account.id);
    expect((await accountFromSession(db, token))?.id).toBe(account.id);
  });

  it("lets an existing account keep signing in without a new lead approval", async () => {
    const admin = await upsertAccount(db, { email: "admin@beacon.test", name: "Admin" });
    process.env.BEACON_ADMIN_EMAILS = "";
    const again = await upsertAccount(db, { email: "admin@beacon.test", name: "Admin", googleSub: "g-admin" });
    expect(again.id).toBe(admin.id);
  });

  it("records approve audits and refuses non-admin approvers", async () => {
    expect(isAdminEmail("rando@example.com")).toBe(false);
    const admin = await upsertAccount(db, { email: "admin@beacon.test", name: "Admin" });
    await db.query(`insert into lead (id, email, status, source) values ($1, $2, 'pending', 'signin')`, [newId("ld"), "wait@example.com"]);
    const lead = (await listLeads(db)).find((l) => l.email === "wait@example.com")!;
    await setLeadStatus(db, lead.id, "approved", admin);
    const ev = await db.one(`select * from audit_event where action = 'early_access_approve' and target_id = $1`, [lead.id]);
    expect(ev?.actor_id).toBe(admin.id);
    expect(ev?.org_id).toBeNull();

    await db.query(`insert into lead (id, email, status) values ($1, $2, 'approved')`, [newId("ld"), "member@example.com"]);
    const outsider = await upsertAccount(db, { email: "member@example.com", name: "Member" });
    await expect(setLeadStatus(db, lead.id, "declined", outsider)).rejects.toThrow(/early-access admins/i);
  });

  it("refuses unverified provider emails that match an admin or an existing account", async () => {
    const admin = await upsertAccount(db, { email: "admin@beacon.test", name: "Admin" });
    await expect(
      upsertAccount(db, { email: "admin@beacon.test", name: "Attacker", googleSub: "g-evil", emailVerified: false }),
    ).rejects.toBeInstanceOf(UnverifiedEmailError);
    expect(await db.one(`select id from account where google_sub = 'g-evil'`)).toBeNull();

    await db.query(`insert into lead (id, email, status, source) values ($1, $2, 'approved', 'test')`, [newId("ld"), "taken@example.com"]);
    const victim = await upsertAccount(db, { email: "taken@example.com", name: "Victim", googleSub: "g-victim" });
    await expect(
      upsertAccount(db, { email: "taken@example.com", name: "Thief", microsoftSub: "m-thief", emailVerified: false }),
    ).rejects.toBeInstanceOf(UnverifiedEmailError);
    expect(await db.one(`select id from account where microsoft_sub = 'm-thief'`)).toBeNull();
    expect((await db.one(`select * from account where id = $1`, [victim.id]))?.google_sub).toBe("g-victim");
    expect(admin.id).toBeTruthy();

    // Same Microsoft sub can still sign in without re-verifying email for linking.
    const ms = await upsertAccount(db, {
      email: "admin@beacon.test",
      name: "Admin",
      microsoftSub: "m-admin",
      emailVerified: true,
    });
    const again = await upsertAccount(db, {
      email: "spoofed@evil.test",
      name: "Admin",
      microsoftSub: "m-admin",
      emailVerified: false,
    });
    expect(again.id).toBe(ms.id);
    expect(again.email).toBe("admin@beacon.test");
  });

  it("reads Microsoft ID-token verification from xms_edov", () => {
    const payload = Buffer.from(JSON.stringify({ email: "a@b.com", xms_edov: true }), "utf8").toString("base64url");
    const jwt = `hdr.${payload}.sig`;
    expect(decodeJwtPayload(jwt)).toMatchObject({ email: "a@b.com", xms_edov: true });
  });
});
