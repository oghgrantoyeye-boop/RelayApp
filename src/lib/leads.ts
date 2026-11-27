// Early-access requests from the marketing site. Each one is saved in the database and, when
// EARLY_ACCESS_WEBHOOK_URL is set, forwarded there (a Slack incoming webhook, Zapier, Make,
// Formspree or any endpoint that accepts JSON). On Vercel without DATABASE_URL the database is
// temporary, so set the webhook before you start sending people to the site.
import { getDb } from "./db";
import { newId } from "./data";

export interface LeadInput {
  email: string;
  name?: string;
  company?: string;
  role?: string;
  teamSize?: string;
  note?: string;
  source?: string;
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export async function saveLead(input: LeadInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!validEmail(email)) return { ok: false, error: "Enter a valid work email." };
  const clip = (s?: string, n = 200) => (s ?? "").trim().slice(0, n) || null;
  const lead = {
    id: newId("ld"),
    email,
    name: clip(input.name),
    company: clip(input.company),
    role: clip(input.role, 60),
    team_size: clip(input.teamSize, 40),
    note: clip(input.note, 2000),
    source: clip(input.source, 120),
  };
  let forwarded = false;
  const hook = process.env.EARLY_ACCESS_WEBHOOK_URL;
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          ...lead,
          text: `New Beacon early-access request: ${lead.name ?? ""} <${lead.email}>${lead.company ? `, ${lead.company}` : ""}${lead.role ? ` (${lead.role})` : ""}${lead.note ? `\n> ${lead.note}` : ""}`,
          created_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(8000),
      });
      forwarded = res.ok;
      if (!res.ok) console.error(`[beacon] Early-access webhook returned ${res.status}`);
    } catch (e) {
      console.error("[beacon] Early-access webhook failed", (e as Error).message);
    }
  } else {
    console.warn("[beacon] EARLY_ACCESS_WEBHOOK_URL is not set; the request is only stored in the database.");
  }
  try {
    const db = await getDb();
    await db.query(
      `insert into lead (id, email, name, company, role, team_size, note, source, forwarded) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [lead.id, lead.email, lead.name, lead.company, lead.role, lead.team_size, lead.note, lead.source, forwarded],
    );
  } catch (e) {
    if (!forwarded) return { ok: false, error: "We couldn't save your request. Please try again in a minute." };
    console.error("[beacon] Saving lead failed after forwarding", (e as Error).message);
  }
  return { ok: true };
}
