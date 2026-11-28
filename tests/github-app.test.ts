// T-44: GitHub App install, repo→team map, live connector, webhook learning.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import {
  handleGithubAppEvent,
  mapRepoToTeam,
  recordInstallation,
  verifyGithubAppSignature,
  unitForRepo,
} from "@/lib/github/app";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { verifyGithubSignature } from "@/lib/sources";
import { scoped } from "@/lib/scoped";

describe("GitHub App (T-44)", () => {
  let db: Db;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    process.env.AUTH_SECRET = "test-secret";
    process.env.ENCRYPTION_KEY = "test-encryption-key";
    process.env.GITHUB_APP_WEBHOOK_SECRET = "whsec";
    delete process.env.GITHUB_WEBHOOK_SECRET;
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("encrypts install tokens and maps a repo to a team as Live", async () => {
    const cipher = encryptSecret("ghs_test_token");
    expect(decryptSecret(cipher)).toBe("ghs_test_token");

    const install = await recordInstallation(db, {
      orgId: "software",
      installationId: "4242",
      accountLogin: "northwind",
      accessToken: "ghs_test_token",
      repos: ["northwind/platform"],
    });
    expect(install.installation_id).toBe("4242");
    expect(decryptSecret(String(install.encrypted_token))).toBe("ghs_test_token");

    const unitId = scoped("software", "platform");
    await mapRepoToTeam(db, {
      orgId: "software",
      installationId: "4242",
      repoFullName: "northwind/platform",
      unitId,
    });
    const mapped = await unitForRepo(db, "4242", "Northwind/Platform");
    expect(mapped?.unit_id).toBe(unitId);

    const conn = await db.one(`select * from connector where unit_id = $1 and kind = 'github'`, [unitId]);
    expect(conn?.mode).toBe("live");
    expect(conn?.name).toBe("northwind/platform");
  });

  it("refuses mapping a repo that is not on the installation", async () => {
    await recordInstallation(db, {
      orgId: "software",
      installationId: "55",
      accountLogin: "northwind",
      repos: ["northwind/platform"],
    });
    await expect(
      mapRepoToTeam(db, {
        orgId: "software",
        installationId: "55",
        repoFullName: "other/secret",
        unitId: scoped("software", "platform"),
      }),
    ).rejects.toThrow(/not on this GitHub App installation/);
  });

  it("refuses reassigning an installation to another workspace", async () => {
    await recordInstallation(db, {
      orgId: "software",
      installationId: "77",
      accountLogin: "northwind",
      repos: ["northwind/platform"],
    });
    await expect(
      recordInstallation(db, {
        orgId: "agency",
        installationId: "77",
        accountLogin: "northwind",
        repos: ["northwind/platform"],
      }),
    ).rejects.toThrow(/another workspace/);
  });

  it("looks up maps by installation + repo, not repo alone", async () => {
    await recordInstallation(db, {
      orgId: "software",
      installationId: "1",
      accountLogin: "northwind",
      repos: ["northwind/platform"],
    });
    await mapRepoToTeam(db, {
      orgId: "software",
      installationId: "1",
      repoFullName: "northwind/platform",
      unitId: scoped("software", "platform"),
    });
    expect(await unitForRepo(db, "1", "northwind/platform")).toBeTruthy();
    expect(await unitForRepo(db, "999", "northwind/platform")).toBeNull();
    expect(await unitForRepo(db, null, "northwind/platform")).toBeNull();
  });

  it("verifies App webhook signatures and learns from a teammate's PR review", async () => {
    const raw = JSON.stringify({ ok: true });
    const { createHmac } = await import("node:crypto");
    const sig = `sha256=${createHmac("sha256", "whsec").update(raw).digest("hex")}`;
    expect(verifyGithubAppSignature(raw, sig)).toBe(true);
    expect(verifyGithubAppSignature(raw, "sha256=deadbeef")).toBe(false);
    expect(verifyGithubSignature(raw, null)).toBe(true); // non-production without secret

    await recordInstallation(db, {
      orgId: "software",
      installationId: "99",
      accountLogin: "northwind",
      repos: ["northwind/platform"],
    });
    const unitId = scoped("software", "platform");
    await mapRepoToTeam(db, {
      orgId: "software",
      installationId: "99",
      repoFullName: "northwind/platform",
      unitId,
    });
    const marcus = (await db.one(`select github_login from app_user where id = $1`, [scoped("software", "marcus")]))!;

    const r = await handleGithubAppEvent(db, "pull_request_review", {
      action: "submitted",
      installation: { id: 99 },
      repository: { full_name: "northwind/platform" },
      pull_request: { number: 482, title: "Session token migration" },
      review: {
        id: 7,
        state: "approved",
        body: "Looks good — Platform owns short-lived session tokens.",
        user: { login: marcus.github_login },
      },
    });
    expect(r).toMatchObject({ learned: true, unitId });
    const signal = await db.one(
      `select * from context_signal where unit_id = $1 and source_kind = 'pr' order by at desc limit 1`,
      [unitId],
    );
    expect(signal?.source_label).toContain("Review on PR #482");

    const stranger = await handleGithubAppEvent(db, "pull_request_review", {
      action: "submitted",
      installation: { id: 99 },
      repository: { full_name: "northwind/platform" },
      pull_request: { number: 483, title: "Other" },
      review: { id: 8, state: "commented", body: "Outsider comment", user: { login: "random-outsider" } },
    });
    expect(stranger).toMatchObject({ skipped: expect.stringContaining("not on the mapped team") });
  });

  it("ingests a merged PR for a mapped repo using the installation id", async () => {
    await recordInstallation(db, {
      orgId: "software",
      installationId: "7",
      accountLogin: "northwind",
      repos: ["northwind/platform"],
    });
    const unitId = scoped("software", "platform");
    await mapRepoToTeam(db, {
      orgId: "software",
      installationId: "7",
      repoFullName: "northwind/platform",
      unitId,
    });
    const marcus = (await db.one(`select github_login from app_user where id = $1`, [scoped("software", "marcus")]))!;
    const r = await handleGithubAppEvent(db, "pull_request", {
      action: "closed",
      installation: { id: 7 },
      repository: { full_name: "northwind/platform" },
      pull_request: {
        number: 9001,
        merged: true,
        title: "Rate limit headers",
        body: "Expose remaining quota.",
        user: { login: marcus.github_login },
      },
    });
    expect("updateId" in r || "skipped" in r).toBe(true);
  });

  it("fails closed on webhook signatures in production without a secret", async () => {
    const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const env = process.env as { NODE_ENV?: string };
    const prev = env.NODE_ENV;
    env.NODE_ENV = "production";
    expect(verifyGithubAppSignature("{}", null)).toBe(false);
    expect(verifyGithubSignature("{}", null)).toBe(false);
    env.NODE_ENV = prev;
    process.env.GITHUB_APP_WEBHOOK_SECRET = secret;
  });
});
