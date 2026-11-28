// Create a real workspace, invite people by email, add teams and pick leads (T-33).
import type { Db, Row } from "../db";
import { audit, newId } from "../data";
import { now } from "../clock";
import { validEmail } from "../leads";
import { ensureMembership } from "./accounts";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

async function uniqueOrgId(db: Db, name: string): Promise<string> {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (await db.one(`select id from org where id = $1`, [id])) {
    id = `${base}-${n++}`;
  }
  return id;
}

async function requireOwner(db: Db, accountId: string, orgId: string): Promise<Row> {
  const m = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [accountId, orgId]);
  if (!m || (m.role !== "owner" && m.role !== "admin")) throw new Error("Only workspace owners can do that");
  return m;
}

/** Create an empty real workspace and put the signed-in account in as owner. */
export async function createWorkspace(
  db: Db,
  account: Row,
  input: { name: string; firstTeam?: string },
): Promise<{ orgId: string; userId: string; unitId: string }> {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) throw new Error("Give the workspace a name");
  const orgId = await uniqueOrgId(db, name);
  const teamName = (input.firstTeam?.trim() || "General").slice(0, 80);
  const unitId = newId("u");
  const userId = newId("u");
  const agentId = `agent_${unitId}`;

  await db.tx(async (t) => {
    await t.query(`insert into org (id, name, settings) values ($1, $2, $3)`, [
      orgId,
      name,
      JSON.stringify({ default_level: "headline" }),
    ]);
    await t.query(
      `insert into unit (id, org_id, slug, name, description, color) values ($1, $2, $3, $4, $5, $6)`,
      [unitId, orgId, slugify(teamName) || "general", teamName, "Your first team", "#0f766e"],
    );
    await t.query(
      `insert into app_user (id, org_id, kind, name, title, email) values ($1, $2, 'human', $3, 'Owner', $4)`,
      [userId, orgId, account.name || account.email.split("@")[0], account.email],
    );
    await t.query(`insert into org_membership (account_id, org_id, user_id, role) values ($1, $2, $3, 'owner')`, [
      account.id,
      orgId,
      userId,
    ]);
    await t.query(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'lead')`, [
      `m_${userId}_${unitId}`,
      orgId,
      unitId,
      userId,
    ]);
    await t.query(
      `insert into app_user (id, org_id, kind, name, title, ask_cadence) values ($1, $2, 'agent', $3, $4, 'immediate')`,
      [agentId, orgId, `${teamName} agent`, "Answers from what the team has published, and routes the rest"],
    );
    await t.query(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'agent')`, [
      `m_${agentId}_${unitId}`,
      orgId,
      unitId,
      agentId,
    ]);
  });

  await audit(db, {
    orgId,
    actorId: userId,
    action: "workspace_create",
    targetKind: "org",
    targetId: orgId,
    detail: { name, firstTeam: teamName },
  });

  return { orgId, userId, unitId };
}

/** Invite someone by email. A pending invite also unlocks account creation (T-36). */
export async function inviteToWorkspace(
  db: Db,
  account: Row,
  orgId: string,
  input: { email: string; unitId?: string; role?: "admin" | "member" },
): Promise<Row> {
  await requireOwner(db, account.id, orgId);
  const email = input.email.trim().toLowerCase();
  if (!validEmail(email)) throw new Error("Enter a valid work email");
  if (email === String(account.email).toLowerCase()) throw new Error("You are already in this workspace");

  if (input.unitId) {
    const unit = await db.one(`select id from unit where id = $1 and org_id = $2`, [input.unitId, orgId]);
    if (!unit) throw new Error("That team is not in this workspace");
  }

  const existing = await db.one(
    `select * from workspace_invite where org_id = $1 and lower(email) = $2 and status = 'pending'`,
    [orgId, email],
  );
  if (existing) return existing;

  const id = newId("inv");
  await db.query(
    `insert into workspace_invite (id, org_id, email, invited_by, role, unit_id, status) values ($1, $2, $3, $4, $5, $6, 'pending')`,
    [id, orgId, email, account.id, input.role === "admin" ? "admin" : "member", input.unitId ?? null],
  );

  // If they already have an account, add them now and mark the invite accepted.
  const invited = await db.one(`select * from account where email = $1`, [email]);
  if (invited) {
    await acceptInviteForAccount(db, invited, id);
  } else {
    await audit(db, {
      orgId,
      actorId: account.id,
      action: "workspace_invite",
      targetKind: "invite",
      targetId: id,
      detail: { email, unitId: input.unitId ?? null },
    });
  }
  return (await db.one(`select * from workspace_invite where id = $1`, [id]))!;
}

/** Accept every pending invite for this account's email (called after sign-in). */
export async function acceptPendingInvites(db: Db, account: Row): Promise<string[]> {
  const pending = await db.query(
    `select * from workspace_invite where lower(email) = $1 and status = 'pending' order by created_at`,
    [String(account.email).toLowerCase()],
  );
  const orgIds: string[] = [];
  for (const inv of pending) {
    await acceptInviteForAccount(db, account, inv.id);
    orgIds.push(inv.org_id);
  }
  return orgIds;
}

async function acceptInviteForAccount(db: Db, account: Row, inviteId: string) {
  const inv = await db.one(`select * from workspace_invite where id = $1`, [inviteId]);
  if (!inv || inv.status !== "pending") return;
  if (String(inv.email).toLowerCase() !== String(account.email).toLowerCase()) {
    throw new Error("This invite is for a different email");
  }
  const membership = await ensureMembership(db, account.id, inv.org_id, {
    name: account.name,
    email: account.email,
    role: inv.role,
  });
  if (inv.unit_id) {
    const already = await db.one(
      `select id from member where user_id = $1 and unit_id = $2`,
      [membership.user_id, inv.unit_id],
    );
    if (!already) {
      await db.query(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'member')`, [
        `m_${membership.user_id}_${inv.unit_id}`,
        inv.org_id,
        inv.unit_id,
        membership.user_id,
      ]);
    }
  }
  await db.query(`update workspace_invite set status = 'accepted', accepted_at = $2 where id = $1`, [
    inviteId,
    now().toISOString(),
  ]);
  await audit(db, {
    orgId: inv.org_id,
    actorId: membership.user_id,
    action: "workspace_invite_accept",
    targetKind: "invite",
    targetId: inviteId,
    detail: { email: inv.email },
  });
}

export async function listInvites(db: Db, orgId: string): Promise<Row[]> {
  return db.query(`select * from workspace_invite where org_id = $1 order by created_at desc`, [orgId]);
}

/** Add a team to the workspace. Optionally set a lead (must already be a member). */
export async function createTeam(
  db: Db,
  account: Row,
  orgId: string,
  input: { name: string; description?: string; leadUserId?: string; color?: string },
): Promise<{ unitId: string }> {
  const membership = await requireOwner(db, account.id, orgId);
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) throw new Error("Give the team a name");
  let slug = slugify(name) || "team";
  let n = 2;
  while (await db.one(`select id from unit where org_id = $1 and slug = $2`, [orgId, slug])) {
    slug = `${slugify(name)}-${n++}`;
  }
  const unitId = newId("u");
  const agentId = `agent_${unitId}`;
  await db.query(
    `insert into unit (id, org_id, slug, name, description, color) values ($1, $2, $3, $4, $5, $6)`,
    [unitId, orgId, slug, name, (input.description ?? "").slice(0, 400), input.color || "#71717a"],
  );
  await db.query(
    `insert into app_user (id, org_id, kind, name, title, ask_cadence) values ($1, $2, 'agent', $3, $4, 'immediate')`,
    [agentId, orgId, `${name} agent`, "Answers from what the team has published, and routes the rest"],
  );
  await db.query(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'agent')`, [
    `m_${agentId}_${unitId}`,
    orgId,
    unitId,
    agentId,
  ]);

  if (input.leadUserId) {
    await setTeamLead(db, account, orgId, unitId, input.leadUserId);
  }

  await audit(db, {
    orgId,
    actorId: membership.user_id,
    action: "team_create",
    targetKind: "unit",
    targetId: unitId,
    detail: { name, leadUserId: input.leadUserId ?? null },
  });
  return { unitId };
}

export async function setTeamLead(db: Db, account: Row, orgId: string, unitId: string, leadUserId: string) {
  await requireOwner(db, account.id, orgId);
  const unit = await db.one(`select id from unit where id = $1 and org_id = $2`, [unitId, orgId]);
  if (!unit) throw new Error("Team not found");
  const user = await db.one(`select id from app_user where id = $1 and org_id = $2 and kind = 'human'`, [
    leadUserId,
    orgId,
  ]);
  if (!user) throw new Error("That person is not in this workspace");

  // Demote existing leads on this team.
  await db.query(`update member set role = 'member' where unit_id = $1 and role = 'lead'`, [unitId]);
  const existing = await db.one(`select id from member where user_id = $1 and unit_id = $2`, [leadUserId, unitId]);
  if (existing) {
    await db.query(`update member set role = 'lead' where id = $1`, [existing.id]);
  } else {
    await db.query(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'lead')`, [
      `m_${leadUserId}_${unitId}`,
      orgId,
      unitId,
      leadUserId,
    ]);
  }
}
