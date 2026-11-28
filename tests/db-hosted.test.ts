import { describe, expect, it } from "vitest";
import { hasHostedDatabase, needsHostedDbWarning } from "@/lib/db";

describe("hosted database (T-04)", () => {
  it("treats DATABASE_URL or POSTGRES_URL as hosted", () => {
    expect(hasHostedDatabase({})).toBe(false);
    expect(hasHostedDatabase({ DATABASE_URL: "postgres://x" })).toBe(true);
    expect(hasHostedDatabase({ POSTGRES_URL: "postgres://y" })).toBe(true);
    expect(hasHostedDatabase({ DATABASE_URL: "  " })).toBe(false);
  });

  it("warns only on Vercel without a hosted database", () => {
    expect(needsHostedDbWarning({ VERCEL: "1" })).toBe(true);
    expect(needsHostedDbWarning({ VERCEL: "1", DATABASE_URL: "postgres://x" })).toBe(false);
    expect(needsHostedDbWarning({})).toBe(false);
    expect(needsHostedDbWarning({ DATABASE_URL: "postgres://x" })).toBe(false);
  });
});
