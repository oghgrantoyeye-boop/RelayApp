// Unit tests for the permission function itself, on a small hand-built policy.
// tests/scenarios.test.ts runs the brief's tests end to end against the seeded Northwind Labs data.
import { describe, expect, it } from "vitest";
import {
  canSeeDerived,
  canWrite,
  deriveMarkings,
  visibleLevel,
  type ItemRef,
  type Policy,
  type Reader,
} from "@/lib/permissions";

const policy: Policy = {
  orgDefaultLevel: "headline",
  interfaces: [
    { id: "i-pay-growth", fromUnitId: "payments", toUnitId: "growth", kinds: ["decision", "risk", "progress"], level: "summary" },
    { id: "i-pay-platform", fromUnitId: "payments", toUnitId: "platform", kinds: ["risk"], level: "full" },
    { id: "i-sales-lead", fromUnitId: "sales", toUnitId: "leadership", kinds: ["request"], level: "full" },
  ],
  markings: {
    conf: { id: "conf", label: "Confidential: Leadership and Sales only", allowedUnitIds: ["leadership", "sales"], othersLevel: "summary" },
    lead: { id: "lead", label: "Leadership only", allowedUnitIds: ["leadership"], othersLevel: "none" },
  },
};

const r = (userId: string, ...unitIds: string[]): Reader => ({ userId, unitIds });
const decision: ItemRef = { type: "update_item", kind: "decision", ownerUnitIds: ["payments"], markingIds: [] };

describe("visibleLevel", () => {
  it("gives a team's own members full detail", () => {
    expect(visibleLevel(policy, r("u1", "payments"), decision)).toEqual({ level: "full", reason: "member" });
  });

  it("gives a following team the interface level", () => {
    expect(visibleLevel(policy, r("u2", "growth"), decision).level).toBe("summary");
  });

  it("gives everyone else the org default (Headline)", () => {
    expect(visibleLevel(policy, r("u3", "mobile"), decision)).toEqual({ level: "headline", reason: "org_default" });
  });

  it("only applies an interface to the kinds it carries", () => {
    // Platform gets risks at full detail from Payments, but decisions only at the org default.
    expect(visibleLevel(policy, r("u4", "platform"), { ...decision, kind: "risk" }).level).toBe("full");
    expect(visibleLevel(policy, r("u4", "platform"), decision).level).toBe("headline");
  });

  it("takes the most detailed level when a reader is in several teams", () => {
    expect(visibleLevel(policy, r("u5", "mobile", "growth"), decision).level).toBe("summary");
  });

  it("lets a marking override an interface that grants more detail", () => {
    const req: ItemRef = { type: "request", kind: "request", ownerUnitIds: ["sales", "payments"], markingIds: ["conf"] };
    expect(visibleLevel(policy, r("sales-1", "sales"), req).level).toBe("full");
    expect(visibleLevel(policy, r("ceo", "leadership"), req).level).toBe("full");
    // Payments is a party to the request, but the marking caps it at Summary (the redacted version).
    expect(visibleLevel(policy, r("pay-1", "payments"), req)).toEqual({ level: "summary", reason: "marking:conf" });
    // Mobile gets only the org default, which the marking doesn't raise.
    expect(visibleLevel(policy, r("mob-1", "mobile"), req).level).toBe("headline");
  });

  it("fails closed on an unknown marking", () => {
    expect(visibleLevel(policy, r("u1", "payments"), { ...decision, markingIds: ["missing"] }).level).toBe("none");
  });

  it("shows a draft only to the people it names", () => {
    const draft: ItemRef = { type: "commitment", kind: "commitment", ownerUnitIds: ["platform"], markingIds: [], draftVisibleTo: ["owner"] };
    expect(visibleLevel(policy, r("owner", "platform"), draft).level).toBe("full");
    expect(visibleLevel(policy, r("teammate", "platform"), draft)).toEqual({ level: "none", reason: "draft" });
    expect(visibleLevel(policy, r("ceo", "leadership"), draft).level).toBe("none");
  });

  it("never lets an agent read more than the person it acts for", () => {
    const agent: Reader = { userId: "pay-agent", unitIds: ["payments"], isAgent: true };
    expect(visibleLevel(policy, agent, decision).level).toBe("full");
    const forGrowth = { ...agent, onBehalfOf: r("g1", "growth") };
    expect(visibleLevel(policy, forGrowth, decision)).toEqual({ level: "summary", reason: "on_behalf_of/interface:i-pay-growth" });
    const forMobile = { ...agent, onBehalfOf: r("m1", "mobile") };
    expect(visibleLevel(policy, forMobile, decision).level).toBe("headline");
  });
});

describe("derived outputs", () => {
  it("carry every marking of their inputs", () => {
    expect(deriveMarkings([{ markingIds: [] }, { markingIds: ["conf"] }, { markingIds: ["lead", "conf"] }])).toEqual(["conf", "lead"]);
  });

  it("are visible only to readers every marking allows", () => {
    expect(canSeeDerived(policy, r("ceo", "leadership"), ["conf", "lead"])).toBe(true);
    expect(canSeeDerived(policy, r("s1", "sales"), ["conf"])).toBe(true);
    expect(canSeeDerived(policy, r("s1", "sales"), ["conf", "lead"])).toBe(false);
    expect(canSeeDerived(policy, r("p1", "payments"), ["conf"])).toBe(false);
    expect(canSeeDerived(policy, r("p1", "payments"), [])).toBe(true);
  });
});

describe("canWrite", () => {
  it("lets only a team's members write its content", () => {
    expect(canWrite(r("p1", "platform"), "platform")).toBe(true);
    expect(canWrite(r("x1", "payments"), "platform")).toBe(false);
  });

  it("lets agents write drafts only", () => {
    const agent: Reader = { userId: "a", unitIds: ["platform"], isAgent: true };
    expect(canWrite(agent, "platform")).toBe(false);
    expect(canWrite(agent, "platform", { draft: true })).toBe(true);
  });
});
