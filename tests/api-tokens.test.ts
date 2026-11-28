// T-45: issue and revoke per-person Claude Code tokens (hashed at rest).
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import {
  issueApiToken,
  revokeApiToken,
  isApiToken,
  connectCommand,
  demoApiToken,
  findUserIdByApiToken,
} from "@/lib/auth/api-tokens";
import { hashToken } from "@/lib/auth/crypto";
import { userByToken, ingestCodingSession } from "@/lib/sources";
import { loadViewer } from "@/lib/data";
import { scoped } from "@/lib/scoped";

describe("Claude Code tokens (T-45)", () => {
  let db: Db;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    process.env.AUTH_SECRET = "test-secret";
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("issues a real token that authenticates coding sessions, and revoke stops it", async () => {
    const user = (await db.one(`select * from app_user where id = $1`, [scoped("software", "marcus")]))!;
    expect(user.api_token).toBeNull();
    expect(user.api_token_hash).toBe(hashToken(demoApiToken(user.id as string)));

    const token = await issueApiToken(db, user);
    expect(isApiToken(token)).toBe(true);
    expect(token).not.toMatch(/^rly_demo_/);
    const row = (await db.one(`select api_token, api_token_hash, api_token_prefix from app_user where id = $1`, [user.id]))!;
    expect(row.api_token).toBeNull();
    expect(row.api_token_hash).toBe(hashToken(token));
    expect(row.api_token_prefix).toBe(token.slice(0, 12));

    const viewer = await userByToken(db, token);
    expect(viewer?.user.id).toBe(user.id);
    expect(await findUserIdByApiToken(db, token)).toBe(user.id);

    await ingestCodingSession(db, viewer!, {
      repo: "northwind/platform",
      branch: "main",
      prompts: ["Tighten rate limits"],
      notes: ["Drafted a change"],
      commits: ["abc1234 rate limits"],
    });
    expect(await db.one(`select id from team_update where author_id = $1 and source = 'coding_agent'`, [user.id])).toBeTruthy();

    const audit = await db.one(`select * from audit_event where action = 'api_token_issue' and actor_id = $1`, [user.id]);
    expect(audit).toBeTruthy();

    await revokeApiToken(db, user);
    const after = (await db.one(`select api_token, api_token_hash from app_user where id = $1`, [user.id]))!;
    expect(after.api_token).toBeNull();
    expect(after.api_token_hash).toBeNull();
    expect(await userByToken(db, token)).toBeNull();
    expect(await db.one(`select * from audit_event where action = 'api_token_revoke' and actor_id = $1`, [user.id])).toBeTruthy();
  });

  it("authenticates seeded demo tokens via hash", async () => {
    const userId = scoped("software", "aisha");
    const demo = demoApiToken(userId);
    expect(await findUserIdByApiToken(db, demo)).toBe(userId);
  });

  it("shows one connect command with the URL and token", () => {
    const cmd = connectCommand("https://beacon.example", "rly_testtoken123456");
    expect(cmd).toBe("curl -fsSL https://beacon.example/beacon.mjs | node --input-type=module - connect --url https://beacon.example --token rly_testtoken123456");
  });

  it("loadViewer still works after a rotate (prefix only in the row)", async () => {
    const user = (await db.one(`select * from app_user where id = $1`, [scoped("software", "aisha")]))!;
    const token = await issueApiToken(db, user);
    const v = await loadViewer(db, user.id, "software");
    expect(v?.user.api_token).toBeNull();
    expect(v?.user.api_token_prefix).toBe(token.slice(0, 12));
    expect(v?.user.api_token_hash).toBe(hashToken(token));
  });
});
