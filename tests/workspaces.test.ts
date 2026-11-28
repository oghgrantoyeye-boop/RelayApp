// T-30: two workspaces with the same team names never leak pages, answers, entries or audit.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { loadPolicy, loadViewer, unitMap, workspaceSnapshot, audit } from "@/lib/data";
import { search } from "@/lib/directory";
import { setNow } from "@/lib/clock";

async function seedMini(db: Db, orgId: string, teamName: string, personId: string, personName: string) {
  const unitId = `${orgId}_platform`;
  const memberId = `m_${personId}_${unitId}`;
  await db.query(`insert into org (id, name, settings) values ($1, $2, $3)`, [
    orgId,
    `${teamName} Co`,
    JSON.stringify({ default_level: "headline", demo: null }),
  ]);
  await db.query(
    `insert into unit (id, org_id, slug, name, parent_unit_id, description, color, how_to_ask) values ($1, $2, 'platform', $3, null, $4, '#0e7490', $5)`,
    [unitId, orgId, "Platform", `${teamName} platform team`, JSON.stringify({ turnaround: "2 business days" })],
  );
  await db.query(
    `insert into app_user (id, org_id, kind, name, title, email) values ($1, $2, 'human', $3, 'Lead', $4)`,
    [personId, orgId, personName, `${personId}@${orgId}.example`],
  );
  await db.query(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'lead')`, [
    memberId, orgId, unitId, personId,
  ]);
  await db.query(
    `insert into ownership_item (id, org_id, unit_id, title, description, owner_member_id, keywords) values ($1, $2, $3, $4, $5, $6, $7)`,
    [`own_${orgId}`, orgId, unitId, `${teamName} rate limits`, "Caps", memberId, ["rate", "limits"]],
  );
  await db.query(
    `insert into update_item (id, org_id, unit_id, author_id, kind, text, summary_text, headline_text, status, created_at, published_at)
     values ($1, $2, $3, $4, 'decision', $5, $5, $5, 'published', $6, $6)`,
    [`ui_${orgId}`, orgId, unitId, personId, `${teamName}-only decision about burst limits`, "2026-12-01T12:00:00Z"],
  );
  await db.query(
    `insert into question (id, org_id, asker_id, unit_id, text, outcome, answer_text, source_refs, created_at)
     values ($1, $2, $3, $4, $5, 'answered', $6, '[]', $7)`,
    [`q_${orgId}`, orgId, personId, unitId, `Can ${teamName} raise limits?`, `Only ${teamName} may see this answer.`, "2026-12-02T12:00:00Z"],
  );
  await audit(db, {
    orgId,
    actorId: personId,
    action: "publish_update",
    targetKind: "update",
    targetId: `ui_${orgId}`,
    detail: { secret: `${teamName}-audit` },
  });
}

describe("workspace isolation", () => {
  let db: Db;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    db = await openDb({});
    await migrate(db);
    await seedMini(db, "acme", "Acme", "acme_ava", "Ava Acme");
    await seedMini(db, "globex", "Globex", "globex_ava", "Ava Globex");
  });

  it("keeps units, people, answers and audit apart when team names overlap", async () => {
    const acme = await workspaceSnapshot(db, "acme");
    const globex = await workspaceSnapshot(db, "globex");

    expect(acme.units.map((u) => u.name)).toEqual(["Platform"]);
    expect(globex.units.map((u) => u.name)).toEqual(["Platform"]);
    expect(acme.people.map((p) => p.id)).toEqual(["acme_ava"]);
    expect(globex.people.map((p) => p.id)).toEqual(["globex_ava"]);

    expect(acme.updates.map((u) => u.id)).toEqual(["ui_acme"]);
    expect(globex.updates.map((u) => u.id)).toEqual(["ui_globex"]);
    expect(acme.questions[0].answer_text).toContain("Acme");
    expect(globex.questions[0].answer_text).toContain("Globex");
    expect(acme.questions[0].answer_text).not.toContain("Globex");
    expect(globex.questions[0].answer_text).not.toContain("Acme");

    expect(acme.audits.every((a) => a.target_id === "ui_acme")).toBe(true);
    expect(globex.audits.every((a) => a.target_id === "ui_globex")).toBe(true);
    expect(JSON.stringify(acme.audits)).not.toContain("Globex-audit");
    expect(JSON.stringify(globex.audits)).not.toContain("Acme-audit");
  });

  it("scopes the viewer, policy, unit map and directory search to one workspace", async () => {
    const avaAcme = await loadViewer(db, "acme_ava", "acme");
    const avaGlobex = await loadViewer(db, "globex_ava", "globex");
    expect(avaAcme?.orgId).toBe("acme");
    expect(avaGlobex?.orgId).toBe("globex");
    expect(await loadViewer(db, "acme_ava", "globex")).toBeNull();
    expect(await loadViewer(db, "globex_ava", "acme")).toBeNull();

    const acmeUnits = await unitMap(db, "acme");
    const globexUnits = await unitMap(db, "globex");
    expect([...acmeUnits.keys()]).toEqual(["acme_platform"]);
    expect([...globexUnits.keys()]).toEqual(["globex_platform"]);

    const acmePolicy = await loadPolicy(db, "acme");
    const globexPolicy = await loadPolicy(db, "globex");
    expect(acmePolicy.orgDefaultLevel).toBe("headline");
    expect(globexPolicy.orgDefaultLevel).toBe("headline");

    const acmeSearch = await search(db, "rate limits", "acme");
    const globexSearch = await search(db, "rate limits", "globex");
    expect(acmeSearch.teams[0].why).toContain("Acme");
    expect(globexSearch.teams[0].why).toContain("Globex");
    expect(acmeSearch.teams[0].why).not.toContain("Globex");
    expect(globexSearch.teams[0].why).not.toContain("Acme");
  });
});

describe("sample workspaces side by side (T-32)", () => {
  it("seeds two demos together and reset leaves the other intact", async () => {
    const { seed } = await import("@/lib/seed");
    const { resetWorkspace } = await import("@/lib/workspace-reset");
    const { scoped } = await import("@/lib/scoped");
    setNow("2026-12-06T09:00:00Z");
    const db = await openDb({});
    await migrate(db);
    await seed(db, "software");
    await seed(db, "cityhall");

    const orgs = await db.query(`select id from org order by id`);
    expect(orgs.map((o) => o.id)).toEqual(["cityhall", "software"]);

    const softPlat = await db.one(`select name from unit where id = $1`, [scoped("software", "platform")]);
    const cityPw = await db.one(`select name from unit where id = $1`, [scoped("cityhall", "publicworks")]);
    expect(softPlat?.name).toBe("Platform");
    expect(cityPw?.name).toBeTruthy();

    const cityPeopleBefore = (await db.one(`select count(*)::int n from app_user where org_id = 'cityhall'`))!.n;
    await resetWorkspace(db, "software");
    expect((await db.one(`select count(*)::int n from app_user where org_id = 'cityhall'`))!.n).toBe(cityPeopleBefore);
    expect((await db.one(`select id from org where id = 'software'`))!.id).toBe("software");
    expect(await db.one(`select id from unit where id = $1`, [scoped("software", "platform")])).not.toBeNull();
  });
});
