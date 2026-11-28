// T-45: issue and revoke per-person Claude Code tokens.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { issueApiToken, revokeApiToken, isApiToken, hookInstallCommand, hookSettingsJson } from "@/lib/auth/api-tokens";
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
    expect(String(user.api_token)).toMatch(/^rly_demo_/);

    const token = await issueApiToken(db, user);
    expect(isApiToken(token)).toBe(true);
    expect(token).not.toMatch(/^rly_demo_/);
    expect((await db.one(`select api_token from app_user where id = $1`, [user.id]))?.api_token).toBe(token);

    const viewer = await userByToken(db, token);
    expect(viewer?.user.id).toBe(user.id);

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
    expect((await db.one(`select api_token from app_user where id = $1`, [user.id]))?.api_token).toBeNull();
    expect(await userByToken(db, token)).toBeNull();
    expect(await db.one(`select * from audit_event where action = 'api_token_revoke' and actor_id = $1`, [user.id])).toBeTruthy();
  });

  it("shows a hook install command that includes the token", () => {
    const cmd = hookInstallCommand("https://beacon.example", "rly_testtoken123456");
    expect(cmd).toContain("RELAY_URL=https://beacon.example");
    expect(cmd).toContain("RELAY_TOKEN=rly_testtoken123456");
    const settings = JSON.parse(hookSettingsJson("https://beacon.example", "rly_testtoken123456"));
    expect(settings.hooks.SessionEnd[0].hooks[0].command).toBe(cmd);
  });

  it("loadViewer still works after a rotate", async () => {
    const user = (await db.one(`select * from app_user where id = $1`, [scoped("software", "aisha")]))!;
    const token = await issueApiToken(db, user);
    const v = await loadViewer(db, user.id, "software");
    expect(v?.user.api_token).toBe(token);
  });
});
