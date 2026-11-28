import type { Db, Row } from "../db";
import { audit, newId } from "../data";
import { now } from "../clock";

export class EarlyAccessError extends Error {
  constructor() {
    super("early_access");
    this.name = "EarlyAccessError";
  }
}

export function adminEmails(): string[] {
  return (process.env.BEACON_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

/** Whether a brand-new account may be created for this email. Existing accounts always sign in. */
export async function canCreateAccount(db: Db, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (isAdminEmail(normalized)) return true;
  const approved = await db.one(`select id from lead where lower(email) = $1 and status = 'approved' limit 1`, [normalized]);
  if (approved) return true;
  const pendingInvite = await db.one(
    `select id from workspace_invite where lower(email) = $1 and status = 'pending' limit 1`,
    [normalized],
  );
  return Boolean(pendingInvite);
}

/** Remember an unapproved sign-in attempt as a lead (source signin). */
export async function recordSignInLead(db: Db, email: string, name?: string): Promise<Row> {
  const normalized = email.trim().toLowerCase();
  const existing = await db.one(`select * from lead where lower(email) = $1 order by created_at desc limit 1`, [normalized]);
  if (existing) return existing;
  const id = newId("ld");
  await db.query(
    `insert into lead (id, email, name, source, status) values ($1, $2, $3, 'signin', 'pending')`,
    [id, normalized, name?.trim() || null],
  );
  return (await db.one(`select * from lead where id = $1`, [id]))!;
}

export async function listLeads(db: Db): Promise<Row[]> {
  return db.query(`select * from lead order by created_at desc limit 200`);
}

export async function setLeadStatus(
  db: Db,
  leadId: string,
  status: "approved" | "declined",
  adminAccount: Row,
): Promise<Row> {
  if (!isAdminEmail(adminAccount.email)) throw new Error("Only early-access admins can do that");
  const lead = await db.one(`select * from lead where id = $1`, [leadId]);
  if (!lead) throw new Error("Lead not found");
  const at = status === "approved" ? now().toISOString() : null;
  await db.query(
    `update lead set status = $2, approved_at = $3, approved_by = $4 where id = $1`,
    [leadId, status, at, status === "approved" ? adminAccount.id : null],
  );
  await audit(db, {
    orgId: null,
    actorId: adminAccount.id,
    action: status === "approved" ? "early_access_approve" : "early_access_decline",
    targetKind: "lead",
    targetId: leadId,
    detail: { email: lead.email, status },
  });
  return (await db.one(`select * from lead where id = $1`, [leadId]))!;
}
