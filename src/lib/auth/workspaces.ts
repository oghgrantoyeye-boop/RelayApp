import type { Db, Row } from "../db";
import { LISTED_DEMOS } from "../demos";
import { membershipsFor } from "./accounts";

export interface WorkspaceChoice {
  id: string;
  name: string;
  kind: "member" | "sample";
  blurb: string;
  userId?: string;
  color: string;
  letter: string;
}

export async function listWorkspaceChoices(db: Db, accountId?: string | null): Promise<{ mine: WorkspaceChoice[]; samples: WorkspaceChoice[] }> {
  const mine: WorkspaceChoice[] = [];
  if (accountId) {
    for (const m of await membershipsFor(db, accountId)) {
      if (m.org_settings?.demo) continue; // sample orgs show in the samples list
      mine.push({
        id: m.org_id,
        name: m.org_name,
        kind: "member",
        blurb: `${m.user_name} · ${m.user_title || m.role}`,
        userId: m.user_id,
        color: "#1d4ed8",
        letter: String(m.org_name || "?").slice(0, 1).toUpperCase(),
      });
    }
  }

  const seeded = await db.query<{ id: string; name: string; settings: Row }>(`select id, name, settings from org order by name`);
  const samples: WorkspaceChoice[] = [];
  for (const pack of LISTED_DEMOS) {
    const org = seeded.find((o) => o.id === pack.id || o.settings?.demo === pack.id);
    samples.push({
      id: pack.id,
      name: pack.org.name,
      kind: "sample",
      blurb: pack.summary || `Explore Beacon with ${pack.org.short}`,
      userId: pack.defaultPersona,
      color: pack.teams.find((t) => !t.group)?.color || "#a16207",
      letter: pack.org.short.slice(0, 1).toUpperCase(),
    });
    if (!org) {
      // Not seeded yet — still listed; opening it will load that demo (T-32 seeds side by side).
    }
  }
  return { mine, samples };
}

export function isSampleOrg(settings: Row | null | undefined): boolean {
  return !!settings?.demo;
}
