// A demo's connected tools, what they synced, its meetings and one finished agent task.
import type { Db } from "./db";
import type { DemoPack } from "./demos";

export async function seedIntegrations(db: Db, pack: DemoPack) {
  const q = (sql: string, params: unknown[]) => db.query(sql, params);
  for (const [id, unit, kind, name, by] of pack.connectors) {
    await q(`insert into connector (id, unit_id, kind, name, connected_by, last_sync_at, created_at) values ($1, $2, $3, $4, $5, $6, $7)`, [
      id, unit, kind, name, by, "2026-12-06T08:55:00Z", "2026-10-05T10:00:00Z",
    ]);
  }
  let n = 0;
  for (const [conn, kind, ref, title, body, status, author, at, marking] of pack.docs) {
    const unit = pack.connectors.find((c) => c[0] === conn)![1];
    await q(
      `insert into source_doc (id, connector_id, unit_id, kind, external_ref, title, body, status, author_name, marking_id, occurred_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [`sd_${++n}`, conn, unit, kind, ref, title, body, status, author, marking ?? null, at],
    );
  }
  for (const [id, unit, conn, title, at, minutes, attendees, transcript, status, marking, summary] of pack.meetings) {
    await q(
      `insert into meeting (id, unit_id, connector_id, title, starts_at, duration_min, attendee_ids, transcript, summary, status, marking_id, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $5)`,
      [id, unit, conn, title, at, minutes, attendees, transcript, summary ? JSON.stringify(summary) : null, status, marking],
    );
  }

  // Agents' monthly budgets ($ of Claude usage), and one finished task to show how runs look.
  await q(`update app_user set monthly_budget_usd = 150, spent_usd = 12 where kind = 'agent'`, []);
  for (const [unit, spent] of Object.entries(pack.agentSpend)) {
    await q(`update app_user set spent_usd = $2 where id = $1`, [`agent_${unit}`, spent]);
  }
  const t = pack.task;
  await q(
    `insert into task_run (id, unit_id, agent_id, requested_by, kind, title, instructions, status, steps, result_md, sources, input_tokens, output_tokens, cost_usd, created_at, updated_at)
     values ($1, $2, $3, $4, 'research', $5, $6, 'done', $7, $8, $9, 48200, 2100, 0.23, $10, $11)`,
    [t.id, t.unit, `agent_${t.unit}`, t.requestedBy, t.title, t.instructions, JSON.stringify(t.steps), t.result, JSON.stringify(t.sources), t.at, t.doneAt],
  );
}
