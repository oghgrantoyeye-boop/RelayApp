// The one permission check. Every page, feed, digest, agent answer and API route decides what a
// reader sees by calling visibleLevel(). Nothing is filtered only in the UI.

export const LEVELS = ["none", "headline", "status", "summary", "full"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  full: "Full detail",
  summary: "Summary",
  status: "Status only",
  headline: "Headline",
  none: "Not shared",
};

export const rank = (l: Level) => LEVELS.indexOf(l);
export const lowerOf = (a: Level, b: Level): Level => (rank(a) <= rank(b) ? a : b);
export const isLevel = (v: unknown): v is Level => typeof v === "string" && (LEVELS as readonly string[]).includes(v);

export interface InterfaceRule {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  /** Item kinds this rule carries: progress, decision, risk, ask, answer, request, commitment. */
  kinds: string[];
  level: Level;
}

export interface MarkingRule {
  id: string;
  label: string;
  allowedUnitIds: string[];
  /** The most a reader outside the allowed teams may see. */
  othersLevel: Level;
}

export interface Policy {
  /** What everyone in the org sees of a team they don't follow. The brief's default is Headline. */
  orgDefaultLevel: Level;
  interfaces: InterfaceRule[];
  markings: Record<string, MarkingRule>;
}

export interface Reader {
  userId: string;
  unitIds: string[];
  isAgent?: boolean;
  /** Set when an agent reads for someone: it never sees more than that person. */
  onBehalfOf?: Reader;
}

export interface ItemRef {
  type: "update_item" | "request" | "commitment" | "ownership" | "page" | "question" | "source" | "meeting" | "task";
  /** The interface kind the item travels under. */
  kind: string;
  /** Teams that read the item in full: its author team; both sides of a request; owner and waiting team of a commitment. */
  ownerUnitIds: string[];
  /** Teams whose interfaces can share the item. Defaults to ownerUnitIds. A commitment is shared by
   * the team that owes it, never by the team waiting on it. */
  publisherUnitIds?: string[];
  markingIds: string[];
  /** For drafts: the only people who can see it until it's confirmed or published. */
  draftVisibleTo?: string[];
  /** A cap the publisher chose for readers outside the owning teams. */
  capLevel?: Level;
  /** People who took part (meeting attendees): they read it in full, like the owning team. */
  participantIds?: string[];
}

export interface Decision {
  level: Level;
  reason: string;
}

export function visibleLevel(policy: Policy, reader: Reader, item: ItemRef): Decision {
  if (reader.onBehalfOf) {
    const own = visibleLevel(policy, { ...reader, onBehalfOf: undefined }, item);
    const theirs = visibleLevel(policy, reader.onBehalfOf, item);
    return rank(theirs.level) < rank(own.level) ? { level: theirs.level, reason: `on_behalf_of/${theirs.reason}` } : own;
  }

  let level: Level;
  let reason: string;
  if (item.draftVisibleTo) {
    if (!item.draftVisibleTo.includes(reader.userId)) return { level: "none", reason: "draft" };
    level = "full";
    reason = "draft_owner";
  } else if (item.ownerUnitIds.some((u) => reader.unitIds.includes(u))) {
    level = "full";
    reason = "member";
  } else if (item.participantIds?.includes(reader.userId)) {
    level = "full";
    reason = "participant";
  } else {
    level = policy.orgDefaultLevel;
    reason = "org_default";
    for (const rule of policy.interfaces) {
      if (
        (item.publisherUnitIds ?? item.ownerUnitIds).includes(rule.fromUnitId) &&
        reader.unitIds.includes(rule.toUnitId) &&
        rule.kinds.includes(item.kind) &&
        rank(rule.level) > rank(level)
      ) {
        level = rule.level;
        reason = `interface:${rule.id}`;
      }
    }
    if (item.capLevel && rank(item.capLevel) < rank(level)) {
      level = item.capLevel;
      reason = "publisher_cap";
    }
  }

  // Markings override interfaces, and also apply to the item's own teams.
  for (const id of item.markingIds) {
    const m = policy.markings[id];
    if (!m) return { level: "none", reason: `marking_unknown:${id}` }; // fail closed
    const allowed = m.allowedUnitIds.some((u) => reader.unitIds.includes(u));
    if (!allowed && rank(m.othersLevel) < rank(level)) {
      level = m.othersLevel;
      reason = `marking:${m.id}`;
    }
  }
  return { level, reason };
}

/** Derived outputs (AI summaries, digests, agent answers) carry every marking of their inputs. */
export function deriveMarkings(inputs: { markingIds: string[] }[]): string[] {
  return [...new Set(inputs.flatMap((i) => i.markingIds))].sort();
}

/**
 * A derived output has a single version, so a reader sees it only if every marking it carries
 * allows them. That makes the strictest input marking always win.
 */
export function canSeeDerived(policy: Policy, reader: Reader, markingIds: string[]): boolean {
  const ok = (r: Reader) =>
    markingIds.every((id) => {
      const m = policy.markings[id];
      return !!m && m.allowedUnitIds.some((u) => r.unitIds.includes(u));
    });
  return ok(reader) && (!reader.onBehalfOf || ok(reader.onBehalfOf));
}

/** Only a team's members write its page, updates, commitments and answers. Agents only write drafts. */
export function canWrite(reader: Reader, unitId: string, opts: { draft?: boolean } = {}): boolean {
  if (reader.onBehalfOf && !opts.draft) return false;
  if (reader.isAgent && !opts.draft) return false;
  return reader.unitIds.includes(unitId);
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export function assertWrite(reader: Reader, unitId: string, what: string, opts: { draft?: boolean } = {}) {
  if (!canWrite(reader, unitId, opts)) throw new PermissionError(`Only members of this team can ${what}.`);
}
