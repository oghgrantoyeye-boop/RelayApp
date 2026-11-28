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
import { loadViewer } from "@/lib/data";

describe("workspace setup (T-33)", () => {
  let db: Db;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    db = await openDb({});
    await migrate(db);
  });

  it("creates a workspace with the owner as lead of the first team", async () => {
    const account = await upsertAccount(db, { email: "ava@northwind.test", name: "Ava Chen" });
    const { orgId, userId, unitId } = await createWorkspace(db, account, {
      name: "Northwind Labs",
      firstTeam: "Platform",
    });
    const org = await db.one(`select * from org where id = $1`, [orgId]);
    expect(org?.name).toBe("Northwind Labs");
    expect(org?.settings?.demo).toBeUndefined();

    const membership = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [
      account.id,
      orgId,
    ]);
    expect(membership?.role).toBe("owner");
    expect(membership?.user_id).toBe(userId);

    const viewer = await loadViewer(db, userId, orgId);
    expect(viewer?.team.id).toBe(unitId);
    expect(viewer?.team.name).toBe("Platform");
    expect(viewer?.team.role).toBe("lead");

    const agent = await db.one(`select * from app_user where id = $1`, [`agent_${unitId}`]);
    expect(agent?.kind).toBe("agent");
  });

  it("invites by email, accepts when the account already exists, and creates teams with leads", async () => {
    const owner = await upsertAccount(db, { email: "owner@acme.test", name: "Owner" });
    const { orgId, userId } = await createWorkspace(db, owner, { name: "Acme" });

    const teammate = await upsertAccount(db, { email: "sam@acme.test", name: "Sam Lee" });
    const invite = await inviteToWorkspace(db, owner, orgId, { email: "sam@acme.test" });
    expect(invite.status).toBe("accepted");
    const samMembership = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [
      teammate.id,
      orgId,
    ]);
    expect(samMembership).toBeTruthy();

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
    const owner = await upsertAccount(db, { email: "lead@globex.test", name: "Lead" });
    const { orgId } = await createWorkspace(db, owner, { name: "Globex" });
    const invite = await inviteToWorkspace(db, owner, orgId, { email: "new@globex.test" });
    expect(invite.status).toBe("pending");
    expect((await listInvites(db, orgId)).some((i) => i.email === "new@globex.test")).toBe(true);

    const newbie = await upsertAccount(db, { email: "new@globex.test", name: "New Hire" });
    const joined = await acceptPendingInvites(db, newbie);
    expect(joined).toEqual([orgId]);
    expect((await db.one(`select status from workspace_invite where id = $1`, [invite.id]))!.status).toBe("accepted");
    expect(await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [newbie.id, orgId])).toBeTruthy();
  });
});
