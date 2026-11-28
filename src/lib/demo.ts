// Which demo organization is loaded. The seeder stores its id on org.id and in org.settings.demo.
import type { Db, Row } from "./db";
import { getDemo, type DemoPack } from "./demos";
import { workersEnabled } from "./flags";

/** Guide steps that open a page hidden while work-performing agents are off. */
const DEFERRED = [/^\/digest/, /^\/map/, /^\/agents\/new/, /\/tasks\//];

/**
 * A real workspace has no demo story. It keeps the pack's shape so pages can read it, but every
 * sample name, example, guide step and template is gone, and the org's own name is used instead.
 */
export function workspacePack(org: Row): DemoPack {
  const base = getDemo(null);
  const name = String(org.name ?? "Your workspace");
  return {
    ...base,
    id: String(org.id),
    audience: "",
    summary: "",
    org: { name, short: name, headcount: 0, domain: "example.com", about: "" },
    intro: { problem: "", cast: [] },
    guide: [],
    explore: [],
    ui: {
      writeExamples: {},
      askExamples: {},
      answerExamples: {},
      searchHint: "Search teams, what they own, or people",
      researchHint: "a competitor, customer or market question",
      sampleSessions: {},
    },
    agentTemplate: { ...base.agentTemplate, team: "", firstJob: "" },
  };
}

export async function activeDemo(db: Db, orgId?: string): Promise<DemoPack> {
  const org = orgId
    ? await db.one(`select id, name, settings from org where id = $1`, [orgId])
    : await db.one(`select id, name, settings from org where settings ? 'demo' order by id limit 1`);
  // Only a sample workspace gets its demo story. A real one never shows Northwind's content.
  if (org && !org.settings?.demo) return workspacePack(org);
  const pack = getDemo(org?.settings?.demo ?? org?.id);
  if (workersEnabled()) return pack;
  const shown = (s: { href: string }) => !DEFERRED.some((r) => r.test(s.href));
  return { ...pack, guide: pack.guide.filter(shown), explore: pack.explore.filter(shown) };
}
