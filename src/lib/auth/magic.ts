import type { Db } from "../db";
import { newId } from "../data";
import { hashToken, randomToken } from "./crypto";
import { now } from "../clock";
import { siteUrl } from "../site-url";
import { emailConfigured } from "./config";
import { upsertAccount, createSession } from "./accounts";

const TTL_MIN = 30;

export async function requestMagicLink(db: Db, email: string): Promise<{ ok: true; devLink?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Enter a valid email address");
  const token = randomToken(32);
  const expires = new Date(now().getTime() + TTL_MIN * 60 * 1000);
  await db.query(`delete from magic_link where email = $1 or expires_at < $2`, [normalized, now().toISOString()]);
  await db.query(`insert into magic_link (id, email, token_hash, expires_at) values ($1, $2, $3, $4)`, [
    newId("ml"),
    normalized,
    hashToken(token),
    expires.toISOString(),
  ]);
  const link = `${siteUrl}/api/auth/magic/verify?token=${encodeURIComponent(token)}`;
  if (emailConfigured()) {
    await sendEmail(normalized, link);
    return { ok: true };
  }
  // Without EMAIL_SERVER: expose the link for local/dev and tests only.
  console.info(`[auth] Magic link for ${normalized}: ${link}`);
  return { ok: true, devLink: link };
}

export async function consumeMagicLink(db: Db, token: string): Promise<{ sessionToken: string; expiresAt: Date }> {
  const row = await db.one(`select * from magic_link where token_hash = $1 and expires_at > $2`, [
    hashToken(token),
    now().toISOString(),
  ]);
  if (!row) throw new Error("That sign-in link is invalid or has expired");
  await db.query(`delete from magic_link where id = $1`, [row.id]);
  const account = await upsertAccount(db, { email: row.email });
  const { acceptPendingInvites } = await import("./workspace-setup");
  await acceptPendingInvites(db, account);
  const session = await createSession(db, account.id);
  return { sessionToken: session.token, expiresAt: session.expiresAt };
}

async function sendEmail(to: string, link: string) {
  const server = process.env.EMAIL_SERVER!.trim();
  if (server.startsWith("http://") || server.startsWith("https://")) {
    const res = await fetch(server, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to,
        subject: "Sign in to Beacon",
        text: `Sign in to Beacon:\n\n${link}\n\nThis link expires in ${TTL_MIN} minutes.`,
      }),
    });
    if (!res.ok) throw new Error(`Email server responded ${res.status}`);
    return;
  }
  throw new Error("EMAIL_SERVER must be an HTTPS webhook URL for now");
}
