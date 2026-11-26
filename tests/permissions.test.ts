import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/lib/db";
import { derivedFor } from "./derived";
import { PERMIT_TYPE, PermissionError, readEntity, writeField } from "../src/lib/entities";
import { loadPermissionContext, visibleLevel } from "../src/lib/permissions";
import { DEMO_REF } from "../src/lib/seed/harborview";
import { seededDb } from "./helpers";

/** The brief's nine permission tests, written before the permission function. */

let db: Db;
beforeAll(async () => {
  db = await seededDb();
});

const otherApplicantsApp = "BP-2027-0369"; // owned by someone other than Northline Homes

describe("permission tests from the brief", () => {
  it("1. Zoning reads a Fire-owned field with no interface to Zoning and gets Not shared", async () => {
    const view = await readEntity(db, "ep", DEMO_REF);
    expect(view.fields.fire_corrections).toMatchObject({ level: "none", locked: true, text: null });
    expect(view.fields.sprinkler_determination.level).toBe("none");
    expect(JSON.stringify(view)).not.toContain("1006.3.4");
  });

  it("2. Building plan review reads the sprinkler determination at Full detail", async () => {
    // The sprinkler interface is the seeded suggestion; Fire approves it in the demo.
    const fresh = await seededDb();
    await fresh.query(
      "update interface set status = 'active' where field_id = 'f_sprinkler_determination' and to_unit_id = 'building'",
    );
    const view = await readEntity(fresh, "jt", DEMO_REF);
    expect(view.fields.sprinkler_determination.level).toBe("full");
    expect(view.fields.sprinkler_determination.text).toContain("NFPA 13R");
    expect(view.fields.sprinkler_determination.text).toContain("egress width");
  });

  it("3. Permit center reads Fire's review at Status only, not the correction text", async () => {
    const view = await readEntity(db, "dana", DEMO_REF);
    expect(view.fields.fire_review).toMatchObject({ level: "status", text: "Changes requested, day 6 of 10" });
    expect(view.fields.fire_corrections.level).toBe("none");
    expect(JSON.stringify(view)).not.toContain("second exit stairway");
    expect(JSON.stringify(view)).not.toContain("Second exit stairway");
  });

  it("4. The applicant sees their own corrections as a summary and can't see another applicant's application", async () => {
    const view = await readEntity(db, "northline", DEMO_REF);
    expect(view.fields.fire_corrections.level).toBe("summary");
    expect(view.fields.fire_corrections.text).toContain("Show a second exit stairway for floors 3 and 4 on your plans.");
    expect(view.fields.fire_corrections.text).not.toContain("1006.3.4");
    // Internal notes and reviewer names stay locked.
    expect(view.fields.fire_notes.locked).toBe(true);
    expect(view.fields.fire_reviewer.locked).toBe(true);
    expect(view.fields.fire_review.text).toBe("Fire prevention review: changes requested");

    await expect(readEntity(db, "northline", otherApplicantsApp)).rejects.toThrow(PermissionError);
    // Same answer as for an application that doesn't exist, so nothing leaks.
    await expect(readEntity(db, "northline", "BP-2027-9999")).rejects.toThrow(`No application BP-2027-9999`);
    await expect(readEntity(db, "northline", otherApplicantsApp)).rejects.toThrow(`No application ${otherApplicantsApp}`);
  });

  it("5. A marking on a field overrides an interface that grants more detail", async () => {
    // Permit center -> Building shares valuation at Full detail; the financial marking caps it at Status only.
    const iface = await db.query<{ level: string }>(
      "select level from interface where field_id = 'f_valuation' and to_unit_id = 'building' and status = 'active'",
    );
    expect(iface.rows[0].level).toBe("full");
    const building = await readEntity(db, "jt", DEMO_REF);
    expect(building.fields.valuation).toMatchObject({ level: "status", text: "Recorded" });
    expect(building.fields.valuation.markings).toEqual(["Contains applicant financial data"]);
    // The owning unit still sees it.
    const permit = await readEntity(db, "dana", DEMO_REF);
    expect(permit.fields.valuation).toMatchObject({ level: "full", text: "$4,200,000" });
  });

  it("6. An AI summary built from a marked field carries that marking", async () => {
    const withMarked = await derivedFor(db, "dana", DEMO_REF, ["valuation", "project"]);
    expect(withMarked.markings).toEqual(["Contains applicant financial data"]);
    const withoutMarked = await derivedFor(db, "dana", DEMO_REF, ["project", "address"]);
    expect(withoutMarked.markings).toEqual([]);
  });

  it("7. The agent, acting for Marcus Hill, can't read anything Marcus can't", async () => {
    const ctx = await loadPermissionContext(db, PERMIT_TYPE);
    const entity = { id: `e_${DEMO_REF}`, applicant_member_id: "northline" };
    const rank = { full: 4, summary: 3, status: 2, headline: 1, none: 0 } as const;
    for (const field of ctx.fields.values()) {
      const marcus = visibleLevel(ctx, "marcus", entity, field);
      const agent = visibleLevel(ctx, "precheck", entity, field, { onBehalfOf: "marcus" });
      expect(rank[agent], field.key).toBeLessThanOrEqual(rank[marcus]);
    }
    // Building's internal notes are not shared with Fire, so the agent can't read them for Marcus.
    const view = await readEntity(db, "precheck", DEMO_REF, { onBehalfOf: "marcus" });
    expect(view.fields.building_notes.locked).toBe(true);
    // And acting for someone with less access, the agent drops to that person's level.
    const forDana = await readEntity(db, "precheck", DEMO_REF, { onBehalfOf: "dana" });
    expect(forDana.fields.fire_corrections.level).toBe("none");
    expect(forDana.fields.fire_review.level).toBe("status");
  });

  it("8. Only Fire prevention members can write Fire-owned fields", async () => {
    const decided = { subject: "Sprinkler system", state: "decided", decision: "NFPA 13R required" };
    await expect(writeField(db, "jt", DEMO_REF, "sprinkler_determination", decided)).rejects.toThrow(PermissionError);
    await expect(writeField(db, "dana", DEMO_REF, "fire_notes", "x")).rejects.toThrow(PermissionError);
    await expect(writeField(db, "northline", DEMO_REF, "fire_corrections", [])).rejects.toThrow(PermissionError);
    // The agent is a Fire member, but changing an entity needs a person's approval.
    await expect(writeField(db, "precheck", DEMO_REF, "fire_notes", "x")).rejects.toThrow(/approval/);

    const before = (await db.query<{ revision: number }>("select revision from entity where external_ref = $1", [DEMO_REF])).rows[0];
    await writeField(db, "marcus", DEMO_REF, "fire_notes", "Called the architect about the stair layout.");
    await writeField(db, "precheck", DEMO_REF, "fire_notes", "Exit count rechecked.", { approvedBy: "marcus" });
    const after = (await db.query<{ revision: number }>("select revision from entity where external_ref = $1", [DEMO_REF])).rows[0];
    expect(after.revision).toBe(before.revision + 2);

    const denied = await db.query("select * from audit_event where action = 'write_denied'");
    expect(denied.rows.length).toBe(4);
  });

  it("9. Every read through the API and the agent writes an audit event, including on_behalf_of", async () => {
    const count = async () =>
      (await db.query<{ n: number }>("select count(*)::int as n from audit_event where action in ('read', 'read_denied')")).rows[0].n;
    const start = await count();

    await readEntity(db, "dana", DEMO_REF);
    await readEntity(db, "precheck", DEMO_REF, { onBehalfOf: "marcus" });
    await readEntity(db, "northline", otherApplicantsApp).catch(() => {});
    expect(await count()).toBe(start + 3);

    const last = await db.query<{ actor_member_id: string; on_behalf_of_member_id: string | null; action: string; target: string }>(
      "select actor_member_id, on_behalf_of_member_id, action, target from audit_event where action in ('read', 'read_denied') order by id desc limit 3",
    );
    expect(last.rows).toEqual([
      { actor_member_id: "northline", on_behalf_of_member_id: null, action: "read_denied", target: otherApplicantsApp },
      { actor_member_id: "precheck", on_behalf_of_member_id: "marcus", action: "read", target: DEMO_REF },
      { actor_member_id: "dana", on_behalf_of_member_id: null, action: "read", target: DEMO_REF },
    ]);
  });
});
