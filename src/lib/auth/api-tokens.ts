// Per-person Claude Code / coding-agent tokens (T-45). Store only a hash + short prefix.
import type { Db, Row } from "../db";
import { hashToken, randomToken } from "./crypto";
import { audit } from "../data";
import { now } from "../clock";

const PREFIX = "rly_";
/** httpOnly cookie that carries the plaintext once after Issue/Rotate. */
export const API_TOKEN_ONCE_COOKIE = "beacon_api_token_once";

export function isApiToken(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX) && value.length > PREFIX.length + 8;
}

export function apiTokenPrefix(token: string): string {
  return token.slice(0, 12);
}

/** Deterministic demo token for a seeded persona (shown only in sample workspaces). */
export function demoApiToken(userId: string): string {
  return `rly_demo_${userId}`;
}

function isUniqueViolation(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err ?? "");
  return /unique|duplicate|constraint/i.test(msg);
}

/** Issue a new personal token. Returns the plaintext once; DB keeps only hash + prefix. */
export async function issueApiToken(db: Db, user: Row): Promise<string> {
  if (user.kind !== "human") throw new Error("Only people get coding-agent tokens");
  let token: string | null = null;
  for (let i = 0; i < 5; i++) {
    const candidate = `${PREFIX}${randomToken(24)}`;
    try {
      await db.query(
        `update app_user set api_token = null, api_token_hash = $2, api_token_prefix = $3 where id = $1`,
        [user.id, hashToken(candidate), apiTokenPrefix(candidate)],
      );
      token = candidate;
      break;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  if (!token) throw new Error("Could not issue a token");
  await audit(db, {
    orgId: user.org_id,
    actorId: user.id,
    action: "api_token_issue",
    targetKind: "user",
    targetId: user.id,
    detail: { at: now().toISOString(), prefix: apiTokenPrefix(token) },
  });
  return token;
}

/** Revoke the person's token so coding-agent hooks stop authenticating. */
export async function revokeApiToken(db: Db, user: Row): Promise<void> {
  if (user.kind !== "human") throw new Error("Only people have coding-agent tokens");
  await db.query(`update app_user set api_token = null, api_token_hash = null, api_token_prefix = null where id = $1`, [user.id]);
  await audit(db, {
    orgId: user.org_id,
    actorId: user.id,
    action: "api_token_revoke",
    targetKind: "user",
    targetId: user.id,
    detail: { at: now().toISOString() },
  });
}

/** Look up a human by the plaintext token (hashes before the query). */
export async function findUserIdByApiToken(db: Db, token: string): Promise<string | null> {
  if (!isApiToken(token)) return null;
  const hashed = hashToken(token);
  const byHash = await db.one(`select id from app_user where api_token_hash = $1 and kind = 'human'`, [hashed]);
  if (byHash) return byHash.id as string;
  // Legacy plaintext column (pre-hash migration / old rows).
  const legacy = await db.one(`select id from app_user where api_token = $1 and kind = 'human'`, [token]);
  return legacy ? (legacy.id as string) : null;
}

/** The one command that connects Claude Code, Codex and Cursor on someone's computer (T-63). */
export function connectCommand(origin: string, token: string): string {
  return `curl -fsSL ${origin}/beacon.mjs | node --input-type=module - connect --url ${origin} --token ${token}`;
}
