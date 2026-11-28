import type { Db, Row } from "../db";
import { newId } from "../data";
import { hashToken, randomToken } from "./crypto";
import { now } from "../clock";
import { canCreateAccount, EarlyAccessError, recordSignInLead } from "./early-access";

export const SESSION_COOKIE = "beacon_session";
const SESSION_DAYS = 30;

export class UnverifiedEmailError extends Error {
  constructor() {
    super("unverified_email");
    this.name = "UnverifiedEmailError";
  }
}

export async function upsertAccount(
  db: Db,
  input: {
    email: string;
    name?: string;
    googleSub?: string;
    microsoftSub?: string;
    /** False when the IdP did not verify the address. Defaults to true for magic-link / trusted callers. */
    emailVerified?: boolean;
  },
): Promise<Row> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("A valid email is required");
  const emailVerified = input.emailVerified !== false;
  let account: Row | null = null;
  if (input.googleSub) account = await db.one(`select * from account where google_sub = $1`, [input.googleSub]);
  if (!account && input.microsoftSub) account = await db.one(`select * from account where microsoft_sub = $1`, [input.microsoftSub]);
  // Never link (or grant admin) by an address the provider has not verified.
  if (!account && emailVerified) account = await db.one(`select * from account where email = $1`, [email]);
  if (!account) {
    if (!emailVerified) throw new UnverifiedEmailError();
    // New accounts need early access: an approved lead, a pending invite (T-33), or an admin email.
    if (!(await canCreateAccount(db, email))) {
      await recordSignInLead(db, email, input.name);
      throw new EarlyAccessError();
    }
    const id = newId("acct");
    await db.query(
      `insert into account (id, email, name, google_sub, microsoft_sub) values ($1, $2, $3, $4, $5)`,
      [id, email, input.name?.trim() || email.split("@")[0], input.googleSub ?? null, input.microsoftSub ?? null],
    );
    account = (await db.one(`select * from account where id = $1`, [id]))!;
  } else {
    await db.query(
      `update account set name = coalesce(nullif($2, ''), name),
        google_sub = coalesce($3, google_sub),
        microsoft_sub = coalesce($4, microsoft_sub),
        email = case when $6 then $5 else email end
       where id = $1`,
      [account.id, input.name?.trim() ?? "", input.googleSub ?? null, input.microsoftSub ?? null, email, emailVerified],
    );
    account = (await db.one(`select * from account where id = $1`, [account.id]))!;
  }
  return account;
}

export async function createSession(db: Db, accountId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(now().getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query(`insert into session (id, account_id, token_hash, expires_at) values ($1, $2, $3, $4)`, [
    newId("sess"),
    accountId,
    hashToken(token),
    expiresAt.toISOString(),
  ]);
  return { token, expiresAt };
}

export async function accountFromSession(db: Db, token: string | undefined | null): Promise<Row | null> {
  if (!token) return null;
  const row = await db.one(
    `select a.*, s.id as session_id, s.expires_at from session s join account a on a.id = s.account_id
     where s.token_hash = $1 and s.expires_at > $2`,
    [hashToken(token), now().toISOString()],
  );
  return row;
}

export async function destroySession(db: Db, token: string | undefined | null) {
  if (!token) return;
  await db.query(`delete from session where token_hash = $1`, [hashToken(token)]);
}

export async function membershipsFor(db: Db, accountId: string): Promise<Row[]> {
  return db.query(
    `select m.*, o.name as org_name, o.settings as org_settings, u.name as user_name, u.title as user_title
     from org_membership m
     join org o on o.id = m.org_id
     join app_user u on u.id = m.user_id
     where m.account_id = $1
     order by o.name`,
    [accountId],
  );
}

/** Ensure this account has an app_user + membership in the workspace (used when inviting later). */
export async function ensureMembership(
  db: Db,
  accountId: string,
  orgId: string,
  opts: { name: string; email: string; role?: string; unitId?: string | null } = { name: "", email: "" },
): Promise<Row> {
  const existing = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [accountId, orgId]);
  if (existing) return existing;
  const userId = newId("u");
  await db.query(
    `insert into app_user (id, org_id, kind, name, title, email) values ($1, $2, 'human', $3, 'Member', $4)`,
    [userId, orgId, opts.name || opts.email.split("@")[0] || "Member", opts.email],
  );
  await db.query(`insert into org_membership (account_id, org_id, user_id, role) values ($1, $2, $3, $4)`, [
    accountId,
    orgId,
    userId,
    opts.role === "owner" || opts.role === "admin" ? opts.role : "member",
  ]);
  // Prefer the invite's team; otherwise put them on the first real team so loadViewer works.
  let unitId = opts.unitId ?? null;
  if (unitId) {
    const unit = await db.one(`select id from unit where id = $1 and org_id = $2`, [unitId, orgId]);
    if (!unit) unitId = null;
  }
  if (!unitId) {
    const unit = await db.one(
      `select id from unit where org_id = $1 order by (how_to_ask = '{}'::jsonb), name limit 1`,
      [orgId],
    );
    unitId = unit?.id ?? null;
  }
  if (unitId) {
    await db.query(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'member')`, [
      `m_${userId}_${unitId}`,
      orgId,
      unitId,
      userId,
    ]);
  }
  return (await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [accountId, orgId]))!;
}
