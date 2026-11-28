// T-33: create a workspace, invite by email, create teams and pick leads.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { setNow } from "@/lib/clock";
import { upsertAccount } from "@/lib/auth/accounts";
import {
  createWorkspace,
  inviteToWorkspace,
  createTeam,
  setTeamLead,
  acceptPendingInvites,
  listInvites,
} from "@/lib/auth/workspace-setup";
import { askTeam, getQuestion } from "@/lib/agent";
import { loadViewer } from "@/lib/data";
import { newId } from "@/lib/data";

async function account(db: Db, email: string, name: string) {
  // Approve a lead so upsertAccount can create without BEACON_ADMIN_EMAILS (T-36 gate).
  const existing = await db.one(`select id from lead where lower(email) = $1`, [email]);
  if (!existing) {
    await db.query(`insert into lead (id, email, status, source) values ($1, $2, 'approved', 'test')`, [newId("ld"), email]);
  } else {
    await db.query(`update lead set status = 'approved' where id = $1`, [existing.id]);
  }
  return upsertAccount(db, { email, name });
}

describe("workspace setup (T-33)", () => {
  let db: Db;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    delete process.env.BEACON_ADMIN_EMAILS;
    db = await openDb({});
    await migrate(db);
  });

  it("creates a workspace with the owner as lead of a real (askable) first team", async () => {
    const acct = await account(db, "ava@northwind.test", "Ava Chen");
    const { orgId, userId, unitId } = await createWorkspace(db, acct, {
      name: "Northwind Labs",
      firstTeam: "Platform",
    });
    const org = await db.one(`select * from org where id = $1`, [orgId]);
    expect(org?.name).toBe("Northwind Labs");
    expect(org?.settings?.demo).toBeUndefined();

    const membership = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [
      acct.id,
      orgId,
    ]);
    expect(membership?.role).toBe("owner");
    expect(membership?.user_id).toBe(userId);

    const unit = await db.one(`select * from unit where id = $1`, [unitId]);
    expect(unit?.how_to_ask?.turnaround).toBe("2 business days");

    const viewer = await loadViewer(db, userId, orgId);
    expect(viewer?.team.id).toBe(unitId);
    expect(viewer?.team.name).toBe("Platform");
    expect(viewer?.team.role).toBe("lead");

    const agent = await db.one(`select * from app_user where id = $1`, [`agent_${unitId}`]);
    expect(agent?.kind).toBe("agent");

    // A team created here can be asked a question (not treated as an org-chart group).
    const { questionId } = await askTeam(db, viewer!, unitId, "When will rate limits land?");
    const q = await getQuestion(db, viewer!, questionId);
    expect(q?.question.text).toContain("rate limits");
  });

  it("invites by email onto one team only, and creates teams with leads", async () => {
    const owner = await account(db, "owner@acme.test", "Owner");
    const { orgId, userId, unitId: generalId } = await createWorkspace(db, owner, { name: "Acme" });
    const { unitId: designId } = await createTeam(db, owner, orgId, { name: "Design" });

    const teammate = await account(db, "sam@acme.test", "Sam Lee");
    const invite = await inviteToWorkspace(db, owner, orgId, { email: "sam@acme.test", unitId: designId });
    expect(invite.status).toBe("accepted");
    const samMembership = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [
      teammate.id,
      orgId,
    ]);
    expect(samMembership).toBeTruthy();

    const samTeams = await db.query(`select unit_id from member where user_id = $1 order by unit_id`, [
      samMembership!.user_id,
    ]);
    expect(samTeams.map((r) => r.unit_id)).toEqual([designId]);
    expect(samTeams.map((r) => r.unit_id)).not.toContain(generalId);

    const design = await db.one(`select how_to_ask from unit where id = $1`, [designId]);
    expect(Object.keys(design?.how_to_ask ?? {}).length).toBeGreaterThan(0);

    const { unitId } = await createTeam(db, owner, orgId, {
      name: "Payments",
      leadUserId: samMembership!.user_id,
    });
    const lead = await db.one(`select * from member where unit_id = $1 and role = 'lead'`, [unitId]);
    expect(lead?.user_id).toBe(samMembership!.user_id);

    await setTeamLead(db, owner, orgId, unitId, userId);
    const after = await db.one(`select * from member where unit_id = $1 and role = 'lead'`, [unitId]);
    expect(after?.user_id).toBe(userId);
  });

  it("keeps a pending invite so a new person can join after they get an account", async () => {
    const owner = await account(db, "lead@globex.test", "Lead");
    const { orgId } = await createWorkspace(db, owner, { name: "Globex" });
    const invite = await inviteToWorkspace(db, owner, orgId, { email: "new@globex.test" });
    expect(invite.status).toBe("pending");
    expect((await listInvites(db, orgId)).some((i) => i.email === "new@globex.test")).toBe(true);

    // Pending invite unlocks account creation without a separate lead approval.
    const newbie = await upsertAccount(db, { email: "new@globex.test", name: "New Hire" });
    const joined = await acceptPendingInvites(db, newbie);
    expect(joined).toEqual([orgId]);
    expect((await db.one(`select status from workspace_invite where id = $1`, [invite.id]))!.status).toBe("accepted");
    expect(await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [newbie.id, orgId])).toBeTruthy();
  });
});
