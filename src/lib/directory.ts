import type { Db, Row } from "./db";
import { overlap, tokens } from "./ai/offline";

export interface SearchResult {
  teams: { team: Row; why: string; score: number }[];
  people: Row[];
}

/** Directory search across teams, what they own, and people. "rate limits" lands on Platform. */
export async function search(db: Db, q: string, orgId?: string): Promise<SearchResult> {
  const words = tokens(q);
  const teams = orgId
    ? await db.query(`select * from unit where org_id = $1 order by name`, [orgId])
    : await db.query(`select * from unit order by name`);
  const owns = orgId
    ? await db.query(`select * from ownership_item where org_id = $1`, [orgId])
    : await db.query(`select * from ownership_item`);
  const people = orgId
    ? await db.query(
        `select a.*, u.name as unit_name, u.slug as unit_slug, m.role from app_user a join member m on m.user_id = a.id join unit u on u.id = m.unit_id
         where a.kind = 'human' and a.org_id = $1 order by a.name`,
        [orgId],
      )
    : await db.query(
        `select a.*, u.name as unit_name, u.slug as unit_slug, m.role from app_user a join member m on m.user_id = a.id join unit u on u.id = m.unit_id
         where a.kind = 'human' order by a.name`,
      );
  const scored = teams
    .map((t) => {
      let score = 2 * overlap(words, tokens(t.name)) + overlap(words, tokens(t.description));
      let why = "";
      for (const o of owns.filter((x) => x.unit_id === t.id)) {
        const s = 3 * overlap(words, tokens(o.title)) + overlap(words, o.keywords.flatMap(tokens));
        if (s > 0 && !why) why = `Owns ${o.title}`;
        score += s;
      }
      return { team: t, why: why || t.description, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const lc = q.trim().toLowerCase();
  const seen = new Set<string>();
  const matchedPeople = lc
    ? people.filter((p) => (p.name.toLowerCase().includes(lc) || p.title.toLowerCase().includes(lc)) && !seen.has(p.id) && seen.add(p.id))
    : [];
  return { teams: scored, people: matchedPeople.slice(0, 20) };
}

export async function orgChart(db: Db, orgId?: string) {
  const units = orgId
    ? await db.query(
        `select u.*, (select a.name from member m join app_user a on a.id = m.user_id where m.unit_id = u.id and m.role = 'lead' limit 1) as lead_name,
                (select count(*)::int from member m join app_user a on a.id = m.user_id where m.unit_id = u.id and a.kind = 'human') as people
         from unit u where u.org_id = $1 order by u.name`,
        [orgId],
      )
    : await db.query(
        `select u.*, (select a.name from member m join app_user a on a.id = m.user_id where m.unit_id = u.id and m.role = 'lead' limit 1) as lead_name,
                (select count(*)::int from member m join app_user a on a.id = m.user_id where m.unit_id = u.id and a.kind = 'human') as people
         from unit u order by u.name`,
      );
  const children = (id: string | null): (Row & { children: Row[] })[] =>
    units.filter((u) => u.parent_unit_id === id).map((u) => ({ ...u, children: children(u.id) }));
  return children(null);
}
