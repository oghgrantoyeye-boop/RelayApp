// Seeds the database with one demo organization (see src/lib/demos). Everything goes through
// normal tables, so each demo exercises the same permission checks as real data.
import type { Db } from "./db";
import { addDays } from "./clock";
import { levelTexts } from "./ai/offline";
import { ALL_KINDS, ORG_ID } from "./data";
import { seedIntegrations } from "./seed-integrations";
import { getDemo, type DemoPack } from "./demos";

const WEEKS = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"];

const at = (date: string, hour = 16) => `${date}T${String(hour).padStart(2, "0")}:00:00Z`;

export async function seed(db: Db, demoId?: string) {
  const pack = getDemo(demoId);
  await db.tx(async (t) => {
    await seedPack(t, pack);
    await seedIntegrations(t, pack);
  });
}

async function seedPack(t: Db, pack: DemoPack) {
  const q = (sql: string, params: unknown[]) => t.query(sql, params);
  const { teams: TEAMS, people: PEOPLE } = pack;
  const teamName = (id: string) => TEAMS.find((x) => x.id === id)!.name;

  await q(`insert into org (id, name, settings) values ($1, $2, $3)`, [
    ORG_ID,
    pack.org.name,
    JSON.stringify({ default_level: "headline", headcount: pack.org.headcount, demo: pack.id, default_persona: pack.defaultPersona }),
  ]);

  for (const team of TEAMS) {
    await q(
      `insert into unit (id, org_id, slug, name, parent_unit_id, description, color, how_to_ask) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [team.id, ORG_ID, team.id, team.name, team.parent, team.description, team.color,
        JSON.stringify(team.group ? {} : { turnaround: team.turnaround ?? "2 business days" })],
    );
  }

  const memberId = (user: string, unit: string) => `m_${user}_${unit}`;
  for (const [id, name, title, team, role] of PEOPLE) {
    await q(
      `insert into app_user (id, org_id, kind, name, title, email, github_login, api_token) values ($1, $2, 'human', $3, $4, $5, $6, $7)`,
      [id, ORG_ID, name, title, `${id}@${pack.org.domain}.example`, name.toLowerCase().replace(/[^a-z]+/g, "-"), `rly_demo_${id}`],
    );
    await q(`insert into member (id, unit_id, user_id, role) values ($1, $2, $3, $4)`, [memberId(id, team), team, id, role]);
  }
  // Leaders of group teams are also on Leadership, so the org chart reads naturally.
  for (const id of pack.alsoOnLeadership) {
    await q(`insert into member (id, unit_id, user_id, role) values ($1, 'leadership', $2, 'member')`, [memberId(id, "leadership"), id]);
  }

  // One agent per team: its front door. It reads with the asker's access.
  for (const team of TEAMS.filter((x) => !x.group)) {
    const id = `agent_${team.id}`;
    await q(`insert into app_user (id, org_id, kind, name, title, ask_cadence) values ($1, $2, 'agent', $3, $4, 'immediate')`, [
      id, ORG_ID, `${team.name} agent`, "Answers from what the team has published, and routes the rest",
    ]);
    await q(`insert into member (id, unit_id, user_id, role) values ($1, $2, $3, 'agent')`, [memberId(id, team.id), team.id, id]);
  }

  for (const [id, unit, title, description, owner, keywords] of pack.owns) {
    await q(`insert into ownership_item (id, unit_id, title, description, owner_member_id, keywords) values ($1, $2, $3, $4, $5, $6)`, [
      id, unit, title, description, memberId(owner, unit), keywords,
    ]);
  }

  for (const m of pack.markings) {
    await q(`insert into marking (id, org_id, label, allowed_unit_ids, others_level) values ($1, $2, $3, $4, $5)`, [
      m.id, ORG_ID, m.label, m.allowed, m.othersLevel,
    ]);
  }

  // Following creates an interface at Summary detail (SPEC.md, "Disclosure levels").
  for (const [unit, followers] of Object.entries(pack.follows)) {
    for (const f of followers) {
      await q(`insert into follow (unit_id, follower_unit_id) values ($1, $2)`, [unit, f]);
      const o = pack.interfaceOverrides.find((x) => x.from === unit && x.to === f);
      const kinds = o?.allKinds ? ALL_KINDS : ALL_KINDS.filter((k) => k !== "request");
      await q(`insert into interface (id, from_unit_id, to_unit_id, kinds, level, cadence) values ($1, $2, $3, $4, $5, $6)`, [
        `if_${unit}_${f}`, unit, f, [...kinds, ...(o?.sources ?? [])], o?.level ?? "summary", o?.cadence ?? "weekly",
      ]);
    }
  }

  const leadOf: Record<string, string> = {};
  for (const [id, , , team, role] of PEOPLE) if (role === "lead") leadOf[team] = id;
  const membersOf = (team: string) => PEOPLE.filter((p) => p[3] === team).map((p) => p[0]);

  // Eight weeks of updates. Each team posts on Fridays.
  let n = 0;
  for (const team of Object.keys(pack.items)) {
    const generic = pack.items[team];
    for (let w = 0; w < WEEKS.length; w++) {
      const picks = generic.filter((_, i) => Math.floor((i * WEEKS.length) / generic.length) === w);
      const story = pack.story.filter((s) => s[0] === team && s[1] === w);
      if (picks.length === 0 && story.length === 0) continue;
      const people = membersOf(team);
      const author = w === WEEKS.length - 1 ? leadOf[team] : people[w % people.length];
      const updateId = `up_${team}_${w}`;
      const publishedAt = at(addDays(WEEKS[w], 4));
      const all = [
        ...picks.map(([kind, text, affected]) => ({ kind, text, ...levelTexts(text), affected, marking: null as string | null, key: "" })),
        ...story.map(([, , kind, text, summary, headline, affected, marking, key]) => ({ kind, text, summary, headline, affected, marking, key })),
      ];
      await q(
        `insert into team_update (id, unit_id, author_id, period_start, body_md, source, status, created_at, published_at) values ($1, $2, $3, $4, $5, 'manual', 'published', $6, $6)`,
        [updateId, team, author, WEEKS[w], all.map((i) => `- ${i.text}`).join("\n"), publishedAt],
      );
      for (const item of all) {
        const id = item.key ? `ui_${item.key}` : `ui_${team}_${w}_${n++}`;
        await q(
          `insert into update_item (id, update_id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, marking_id, status, created_at, published_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', $11, $11)`,
          [id, updateId, team, author, item.kind, item.text, item.summary, item.headline, item.affected, item.marking, publishedAt],
        );
      }
      await q(
        `insert into audit_event (org_id, actor_id, action, target_kind, target_id, detail, at) values ($1, $2, 'publish_update', 'update', $3, $4, $5)`,
        [ORG_ID, author, updateId, JSON.stringify({ items: all.length }), publishedAt],
      );
    }
  }

  for (const [id, from, to, requester, title, details, created, needed, status, own, assignee, cluster, via] of pack.requests) {
    await q(
      `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, needed_by, status, ownership_item_id, assignee_member_id, cluster_key, via, created_at, headline_text)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [id, ORG_ID, from, to, requester, title, details, needed, status, own, memberId(assignee, to), cluster, via, at(created, 15),
        `Request from ${teamName(from)} to ${teamName(to)}`],
    );
  }
  // A confidential request names what's secret, so it carries versions safe for Summary and Headline.
  for (const r of pack.confidentialRequests) {
    await q(
      `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, summary_title, summary_details, headline_text, needed_by, status, ownership_item_id, assignee_member_id, marking_id, cluster_key, via, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', $12, $13, $14, $15, 'form', $16)`,
      [r.id, ORG_ID, r.from, r.to, r.requester, r.title, r.details, r.summaryTitle, r.summaryDetails, r.headline, r.neededBy, r.ownership,
        memberId(r.assignee, r.to), r.marking, r.cluster, r.created],
    );
  }

  for (const [id, owner, ownerUser, waiting, title, due, status, sk, sid, blocked, reason, done] of pack.commitments) {
    await q(
      `insert into commitment (id, owner_unit_id, owner_member_id, waiting_unit_id, source_kind, source_id, title, due_date, original_due_date, status, confirmed_at, done_at, slip_reason, blocked_by_id, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13, $10)`,
      [id, owner, memberId(ownerUser, owner), waiting, sk, sid, title, due, status, at(addDays(due, -14), 17), done ? at(done) : null, reason, blocked],
    );
  }

  // Questions people asked team agents, so agent stats and history look real.
  for (const [id, asker, unit, text, outcome, answer, refs, req, date] of pack.questions) {
    await q(
      `insert into question (id, org_id, asker_id, unit_id, text, outcome, answer_text, source_refs, request_id, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, ORG_ID, asker, unit, text, outcome, answer, JSON.stringify(refs), req, at(date, 14)],
    );
    await q(
      `insert into audit_event (org_id, actor_id, on_behalf_of_id, action, target_kind, target_id, detail, at) values ($1, $2, $3, $4, 'question', $5, $6, $7)`,
      [ORG_ID, `agent_${unit}`, asker, outcome === "answered" ? "agent_answer" : "agent_route", id, JSON.stringify({ question: text }), at(date, 14)],
    );
  }
}
