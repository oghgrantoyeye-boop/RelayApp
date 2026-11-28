// Per-person Claude Code / coding-agent tokens (T-45). Replaces seeded rly_demo_* for real use.
import type { Db, Row } from "../db";
import { randomToken } from "./crypto";
import { audit } from "../data";
import { now } from "../clock";

const PREFIX = "rly_";

export function isApiToken(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX) && value.length > PREFIX.length + 8;
}

/** Issue a new personal token for this app_user. Returns the plaintext once (also stored for the Connect UI). */
export async function issueApiToken(db: Db, user: Row): Promise<string> {
  if (user.kind !== "human") throw new Error("Only people get coding-agent tokens");
  // Retry a few times in case of the unique constraint on api_token.
  for (let i = 0; i < 5; i++) {
    const token = `${PREFIX}${randomToken(24)}`;
    try {
      await db.query(`update app_user set api_token = $2 where id = $1`, [user.id, token]);
      await audit(db, {
        orgId: user.org_id,
        actorId: user.id,
        action: "api_token_issue",
        targetKind: "user",
        targetId: user.id,
        detail: { at: now().toISOString() },
      });
      return token;
    } catch {
      // unique collision — try again
    }
  }
  throw new Error("Could not issue a token");
}

/** Revoke the person's token so coding-agent hooks stop authenticating. */
export async function revokeApiToken(db: Db, user: Row): Promise<void> {
  if (user.kind !== "human") throw new Error("Only people have coding-agent tokens");
  await db.query(`update app_user set api_token = null where id = $1`, [user.id]);
  await audit(db, {
    orgId: user.org_id,
    actorId: user.id,
    action: "api_token_revoke",
    targetKind: "user",
    targetId: user.id,
    detail: { at: now().toISOString() },
  });
}

export function hookInstallCommand(origin: string, token: string): string {
  return `RELAY_URL=${origin} RELAY_TOKEN=${token} node ~/.claude/hooks/relay-hook.mjs`;
}

export function hookSettingsJson(origin: string, token: string): string {
  return JSON.stringify(
    {
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: hookInstallCommand(origin, token) }] }],
      },
    },
    null,
    2,
  );
}
