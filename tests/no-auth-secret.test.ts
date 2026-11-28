// A production deploy that hasn't set AUTH_SECRET yet must still open the sample workspace. Sign-in
// and coding-agent tokens need the secret; the demo doesn't.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate } from "@/lib/db";
import { seed } from "@/lib/seed";
import { accountFromSession } from "@/lib/auth/accounts";

const saved = { VERCEL_ENV: process.env.VERCEL_ENV, AUTH_SECRET: process.env.AUTH_SECRET };

describe("production without AUTH_SECRET", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    delete process.env.AUTH_SECRET;
  });
  afterEach(() => {
    process.env.VERCEL_ENV = saved.VERCEL_ENV;
    if (saved.AUTH_SECRET === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved.AUTH_SECRET;
  });

  it("still seeds the demo and treats an old session cookie as signed out", async () => {
    const db = await openDb({});
    await migrate(db);
    await expect(seed(db)).resolves.not.toThrow();
    const people = await db.one(`select count(*)::int as n, count(api_token_hash)::int as hashed from app_user`);
    expect(people!.n).toBeGreaterThan(0);
    expect(people!.hashed).toBe(0);
    expect(await accountFromSession(db, "stale-cookie")).toBeNull();
  });
});
