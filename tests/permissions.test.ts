import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/lib/db";
import { ENTITY_TYPE, PermissionError, readEntity, writeField } from "../src/lib/entities";
import { loadPermissionContext, visibleLevel } from "../src/lib/permissions";
import { DEMO_REF } from "../src/lib/seed";
import { derivedFor } from "./derived";
import { seededDb } from "./helpers";

/**
 * The brief's nine permission tests, restated for the Larkspur demo pack.
 * Compliance plays the role the brief gave Fire prevention: it owns the
 * findings and the certification decision, and runs the pre-check agent.
 */

let db: Db;
beforeAll(async () => {
  db = await seededDb();
});

const otherPartnersLaunch = "LK-009"; // Basecamp Supply's, not Summit Cycles'

describe("permission tests from the brief", () => {
  it("1. Marketing reads a Compliance-owned field with no interface to Marketing, and gets Not shared", async () => {
    const view = await readEntity(db, "jo", DEMO_REF);
    expect(view.fields.compliance_findings).toMatchObject({ level: "none", locked: true, text: null });
    expect(view.fields.certification.level).toBe("none");
    expect(JSON.stringify(view)).not.toContain("UN 38.3");
  });

  it("2. Supply chain reads the certification decision at Full detail", async () => {
    // The certification interface is the seeded suggestion; Compliance approves it in the demo.
    const fresh = await seededDb();
    await fresh.query("update interface set status = 'active' where field_id = 'f_certification' and to_unit_id = 'supply'");
    const view = await readEntity(fresh, "lena", DEMO_REF);
    expect(view.fields.certification.level).toBe("full");
    expect(view.fields.certification.text).toContain("UL 2849 via Intertek");
    expect(view.fields.certification.text).toContain("ocean freight");
  });

  it("3. Product reads Compliance's review at Status only, not the findings text", async () => {
    const view = await readEntity(db, "maya", DEMO_REF);
    expect(view.fields.compliance_status).toMatchObject({ level: "status", text: "Changes requested, day 6 of 10" });
    expect(view.fields.compliance_findings.level).toBe("none");
    expect(JSON.stringify(view)).not.toContain("UN 38.3");
  });

  it("4. A retail partner sees their own launch in summary and headline form, and can't see another partner's at all", async () => {
    const view = await readEntity(db, "summit", DEMO_REF);
    expect(view.fields.summary.level).toBe("summary");
    expect(view.fields.summary.text).toBe("Launch the Trailhead commuter e-bike in 140 stores on Mar 3.");
    expect(view.fields.compliance_status.text).toBe("Compliance: changes requested");
    // Internal notes, findings and reviewer names stay locked.
    expect(view.fields.compliance_notes.locked).toBe(true);
    expect(view.fields.compliance_findings.locked).toBe(true);
    expect(view.fields.compliance_reviewer.locked).toBe(true);
    expect(view.fields.engineering_notes.locked).toBe(true);

    // Same answer as for something that doesn't exist, so nothing leaks.
    await expect(readEntity(db, "summit", otherPartnersLaunch)).rejects.toThrow(`Nothing found for ${otherPartnersLaunch}`);
    await expect(readEntity(db, "summit", "LK-999")).rejects.toThrow("Nothing found for LK-999");
    await expect(readEntity(db, "summit", otherPartnersLaunch)).rejects.toThrow(PermissionError);
  });

  it("5. A marking on a field overrides an interface that grants more detail", async () => {
    // Product -> Marketing shares the price at Full detail; the pricing marking caps it at Status only.
    const iface = await db.query<{ level: string }>(
      "select level from interface where field_id = 'f_price' and to_unit_id = 'marketing' and status = 'active'",
    );
    expect(iface.rows[0].level).toBe("full");
    const marketing = await readEntity(db, "jo", DEMO_REF);
    expect(marketing.fields.price).toMatchObject({ level: "status", text: "Recorded" });
    expect(marketing.fields.price.markings).toEqual(["Unannounced pricing"]);
    // Sales is on the marking's allowed list, and the owning team always sees it.
    expect((await readEntity(db, "ravi", DEMO_REF)).fields.price).toMatchObject({ level: "full", text: "$2,499" });
    expect((await readEntity(db, "maya", DEMO_REF)).fields.price).toMatchObject({ level: "full", text: "$2,499" });
  });

  it("6. An AI summary built from a marked field carries that marking", async () => {
    const withMarked = await derivedFor(db, "maya", DEMO_REF, ["price", "name"]);
    expect(withMarked.markings).toEqual(["Unannounced pricing"]);
    const withoutMarked = await derivedFor(db, "maya", DEMO_REF, ["name", "summary"]);
    expect(withoutMarked.markings).toEqual([]);
  });

  it("7. The agent, acting for Nina Patel, can't read anything Nina can't", async () => {
    const ctx = await loadPermissionContext(db, ENTITY_TYPE);
    const entity = { id: `e_${DEMO_REF}`, external_owner_id: "summit" };
    const rank = { full: 4, summary: 3, status: 2, headline: 1, none: 0 } as const;
    for (const field of ctx.fields.values()) {
      const nina = visibleLevel(ctx, "nina", entity, field);
      const agent = visibleLevel(ctx, "precheck", entity, field, { onBehalfOf: "nina" });
      expect(rank[agent], field.key).toBeLessThanOrEqual(rank[nina]);
    }
    // Engineering's internal notes aren't shared with Compliance, so the agent can't read them for Nina.
    const view = await readEntity(db, "precheck", DEMO_REF, { onBehalfOf: "nina" });
    expect(view.fields.engineering_notes.locked).toBe(true);
    // Acting for someone with less access, the agent drops to that person's level.
    const forMaya = await readEntity(db, "precheck", DEMO_REF, { onBehalfOf: "maya" });
    expect(forMaya.fields.compliance_findings.level).toBe("none");
    expect(forMaya.fields.compliance_status.level).toBe("status");
  });

  it("8. Only Compliance members can write Compliance-owned fields", async () => {
    const decided = { subject: "Battery certification", state: "decided", decision: "UL 2849 certified" };
    await expect(writeField(db, "lena", DEMO_REF, "certification", decided)).rejects.toThrow(PermissionError);
    await expect(writeField(db, "maya", DEMO_REF, "compliance_notes", "x")).rejects.toThrow(PermissionError);
    await expect(writeField(db, "summit", DEMO_REF, "compliance_findings", [])).rejects.toThrow(PermissionError);
    // The agent is a Compliance member, but changing an entity needs a person's approval.
    await expect(writeField(db, "precheck", DEMO_REF, "compliance_notes", "x")).rejects.toThrow(/approval/);

    const rev = async () =>
      (await db.query<{ revision: number }>("select revision from entity where external_ref = $1", [DEMO_REF])).rows[0].revision;
    const before = await rev();
    await writeField(db, "nina", DEMO_REF, "compliance_notes", "Called Intertek to hold the Jan 21 slot.");
    await writeField(db, "precheck", DEMO_REF, "compliance_notes", "Label artwork rechecked.", { approvedBy: "nina" });
    expect(await rev()).toBe(before + 2);

    const denied = await db.query("select * from audit_event where action = 'write_denied'");
    expect(denied.rows.length).toBe(4);
  });

  it("9. Every read through the API and the agent writes an audit event, including on_behalf_of", async () => {
    const count = async () =>
      (await db.query<{ n: number }>("select count(*)::int as n from audit_event where action in ('read', 'read_denied')")).rows[0].n;
    const start = await count();

    await readEntity(db, "maya", DEMO_REF);
    await readEntity(db, "precheck", DEMO_REF, { onBehalfOf: "nina" });
    await readEntity(db, "summit", otherPartnersLaunch).catch(() => {});
    expect(await count()).toBe(start + 3);

    const last = await db.query(
      "select actor_member_id, on_behalf_of_member_id, action, target from audit_event where action in ('read', 'read_denied') order by id desc limit 3",
    );
    expect(last.rows).toEqual([
      { actor_member_id: "summit", on_behalf_of_member_id: null, action: "read_denied", target: otherPartnersLaunch },
      { actor_member_id: "precheck", on_behalf_of_member_id: "nina", action: "read", target: DEMO_REF },
      { actor_member_id: "maya", on_behalf_of_member_id: null, action: "read", target: DEMO_REF },
    ]);
  });
});
