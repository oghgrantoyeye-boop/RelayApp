// Seeds one demo organization under org.id = pack.id. Row ids are prefixed with pack.id so
// several samples can sit side by side (T-32). Pack files keep short local ids; scoping happens here.
import type { Db } from "./db";
import { addDays } from "./clock";
import { levelTexts } from "./ai/offline";
import { ALL_KINDS } from "./data";
import { seedIntegrations } from "./seed-integrations";
import { getDemo, type DemoPack } from "./demos";
import { scoped, scopedMany, scopedOpt, scopedPersona } from "./scoped";

const WEEKS = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"];

const at = (date: string, hour = 16) => `${date}T${String(hour).padStart(2, "0")}:00:00Z`;

export async function seed(db: Db, demoId?: string) {
  const pack = getDemo(demoId);
  const exists = await db.one(`select id from org where id = $1`, [pack.id]);
  if (exists) throw new Error(`Workspace ${pack.id} is already seeded; reset it first`);
  await db.tx(async (t) => {
    await seedPack(t, pack);
    await seedIntegrations(t, pack);
  });
}

async function seedPack(t: Db, pack: DemoPack) {
  const q = (sql: string, params: unknown[]) => t.query(sql, params);
  const { teams: TEAMS, people: PEOPLE } = pack;
  const orgId = pack.id;
  const s = (local: string) => scoped(orgId, local);
  const teamName = (id: string) => TEAMS.find((x) => x.id === id)!.name;
  const memberId = (user: string, unit: string) => `m_${s(user)}_${s(unit)}`;

  await q(`insert into org (id, name, settings) values ($1, $2, $3)`, [
    orgId,
    pack.org.name,
    JSON.stringify({
      default_level: "headline",
      headcount: pack.org.headcount,
      demo: pack.id,
      default_persona: scopedPersona(orgId, pack.defaultPersona),
    }),
  ]);

  for (const team of TEAMS) {
    await q(
      `insert into unit (id, org_id, slug, name, parent_unit_id, description, color, how_to_ask) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        s(team.id),
        orgId,
        team.id,
        team.name,
        scopedOpt(orgId, team.parent),
        team.description,
        team.color,
        JSON.stringify(team.group ? {} : { turnaround: team.turnaround ?? "2 business days" }),
      ],
    );
  }

  for (const [id, name, title, team, role] of PEOPLE) {
    await q(
      `insert into app_user (id, org_id, kind, name, title, email, github_login, api_token) values ($1, $2, 'human', $3, $4, $5, $6, $7)`,
      [s(id), orgId, name, title, `${id}@${pack.org.domain}.example`, name.toLowerCase().replace(/[^a-z]+/g, "-"), `rly_demo_${s(id)}`],
    );
    await q(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, $5)`, [
      memberId(id, team), orgId, s(team), s(id), role,
    ]);
  }
  for (const id of pack.alsoOnLeadership) {
    await q(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'member')`, [
      memberId(id, "leadership"), orgId, s("leadership"), s(id),
    ]);
  }

  for (const team of TEAMS.filter((x) => !x.group)) {
    const id = `agent_${s(team.id)}`;
    await q(`insert into app_user (id, org_id, kind, name, title, ask_cadence) values ($1, $2, 'agent', $3, $4, 'immediate')`, [
      id, orgId, `${team.name} agent`, "Answers from what the team has published, and routes the rest",
    ]);
    await q(`insert into member (id, org_id, unit_id, user_id, role) values ($1, $2, $3, $4, 'agent')`, [
      `m_${id}_${s(team.id)}`, orgId, s(team.id), id,
    ]);
  }

  for (const [id, unit, title, description, owner, keywords] of pack.owns) {
    await q(`insert into ownership_item (id, org_id, unit_id, title, description, owner_member_id, keywords) values ($1, $2, $3, $4, $5, $6, $7)`, [
      s(id), orgId, s(unit), title, description, memberId(owner, unit), keywords,
    ]);
  }

  for (const m of pack.markings) {
    await q(`insert into marking (id, org_id, label, allowed_unit_ids, others_level) values ($1, $2, $3, $4, $5)`, [
      s(m.id), orgId, m.label, scopedMany(orgId, m.allowed), m.othersLevel,
    ]);
  }

  for (const [unit, followers] of Object.entries(pack.follows)) {
    for (const f of followers) {
      await q(`insert into follow (org_id, unit_id, follower_unit_id) values ($1, $2, $3)`, [orgId, s(unit), s(f)]);
      const o = pack.interfaceOverrides.find((x) => x.from === unit && x.to === f);
      const kinds = o?.allKinds ? ALL_KINDS : ALL_KINDS.filter((k) => k !== "request");
      await q(`insert into interface (id, org_id, from_unit_id, to_unit_id, kinds, level, cadence) values ($1, $2, $3, $4, $5, $6, $7)`, [
        s(`if_${unit}_${f}`), orgId, s(unit), s(f), [...kinds, ...(o?.sources ?? [])], o?.level ?? "summary", o?.cadence ?? "weekly",
      ]);
    }
  }

  const leadOf: Record<string, string> = {};
  for (const [id, , , team, role] of PEOPLE) if (role === "lead") leadOf[team] = id;
  const membersOf = (team: string) => PEOPLE.filter((p) => p[3] === team).map((p) => p[0]);

  let n = 0;
  for (const team of Object.keys(pack.items)) {
    const generic = pack.items[team];
    for (let w = 0; w < WEEKS.length; w++) {
      const picks = generic.filter((_, i) => Math.floor((i * WEEKS.length) / generic.length) === w);
      const story = pack.story.filter((x) => x[0] === team && x[1] === w);
      if (picks.length === 0 && story.length === 0) continue;
      const people = membersOf(team);
      const author = w === WEEKS.length - 1 ? leadOf[team] : people[w % people.length];
      const updateId = s(`up_${team}_${w}`);
      const publishedAt = at(addDays(WEEKS[w], 4));
      const all = [
        ...picks.map(([kind, text, affected]) => ({ kind, text, ...levelTexts(text), affected, marking: null as string | null, key: "" })),
        ...story.map(([, , kind, text, summary, headline, affected, marking, key]) => ({ kind, text, summary, headline, affected, marking, key })),
      ];
      await q(
        `insert into team_update (id, org_id, unit_id, author_id, period_start, body_md, source, status, created_at, published_at) values ($1, $2, $3, $4, $5, $6, 'manual', 'published', $7, $7)`,
        [updateId, orgId, s(team), s(author), WEEKS[w], all.map((i) => `- ${i.text}`).join("\n"), publishedAt],
      );
      for (const item of all) {
        const id = item.key ? s(`ui_${item.key}`) : s(`ui_${team}_${w}_${n++}`);
        await q(
          `insert into update_item (id, org_id, update_id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, marking_id, status, created_at, published_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published', $12, $12)`,
          [id, orgId, updateId, s(team), s(author), item.kind, item.text, item.summary, item.headline, scopedMany(orgId, item.affected), scopedOpt(orgId, item.marking), publishedAt],
        );
      }
      await q(
        `insert into audit_event (org_id, actor_id, action, target_kind, target_id, detail, at) values ($1, $2, 'publish_update', 'update', $3, $4, $5)`,
        [orgId, s(author), updateId, JSON.stringify({ items: all.length }), publishedAt],
      );
    }
  }

  for (const [id, from, to, requester, title, details, created, needed, status, own, assignee, cluster, via] of pack.requests) {
    await q(
      `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, needed_by, status, ownership_item_id, assignee_member_id, cluster_key, via, created_at, headline_text)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        s(id), orgId, s(from), s(to), s(requester), title, details, needed, status, scopedOpt(orgId, own), memberId(assignee, to),
        cluster, via, at(created, 15), `Request from ${teamName(from)} to ${teamName(to)}`,
      ],
    );
  }
  for (const r of pack.confidentialRequests) {
    await q(
      `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, summary_title, summary_details, headline_text, needed_by, status, ownership_item_id, assignee_member_id, marking_id, cluster_key, via, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', $12, $13, $14, $15, 'form', $16)`,
      [
        s(r.id), orgId, s(r.from), s(r.to), s(r.requester), r.title, r.details, r.summaryTitle, r.summaryDetails, r.headline, r.neededBy,
        s(r.ownership), memberId(r.assignee, r.to), s(r.marking), r.cluster, r.created,
      ],
    );
  }

  for (const [id, owner, ownerUser, waiting, title, due, status, sk, sid, blocked, reason, done] of pack.commitments) {
    await q(
      `insert into commitment (id, org_id, owner_unit_id, owner_member_id, waiting_unit_id, source_kind, source_id, title, due_date, original_due_date, status, confirmed_at, done_at, slip_reason, blocked_by_id, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12, $13, $14, $11)`,
      [
        s(id), orgId, s(owner), memberId(ownerUser, owner), scopedOpt(orgId, waiting), sk, scopedOpt(orgId, sid),
        title, due, status, at(addDays(due, -14), 17), done ? at(done) : null, reason, scopedOpt(orgId, blocked),
      ],
    );
  }

  for (const [id, asker, unit, text, outcome, answer, refs, req, date] of pack.questions) {
    await q(
      `insert into question (id, org_id, asker_id, unit_id, text, outcome, answer_text, source_refs, request_id, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [s(id), orgId, s(asker), s(unit), text, outcome, answer, JSON.stringify(refs.map((r) => (r.includes(":") ? r : s(r)))), scopedOpt(orgId, req), at(date, 14)],
    );
    await q(
      `insert into audit_event (org_id, actor_id, on_behalf_of_id, action, target_kind, target_id, detail, at) values ($1, $2, $3, $4, 'question', $5, $6, $7)`,
      [orgId, `agent_${s(unit)}`, s(asker), outcome === "answered" ? "agent_answer" : "agent_route", s(id), JSON.stringify({ question: text }), at(date, 14)],
    );
  }
}
