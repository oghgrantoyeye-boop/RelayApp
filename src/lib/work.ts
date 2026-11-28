// Work a team's agent does for a member: research (Claude with web search) and drafting the team's
// update from its connected tools. Every run is shared with the whole team, which can comment,
// redirect it or take it over. Runs are logged, cost is tracked against the agent's monthly budget,
// and nothing the agent produces is shared outside the team until a person publishes it.
import { workersEnabled, WORKERS_OFF_MESSAGE } from "./flags";
import { activeDemo } from "./demo";
import type { Db, Row } from "./db";
import { addDays, fmt, now, today } from "./clock";
import { audit, loadPolicy, loadViewer, newId, refTask, type Viewer } from "./data";
import { analyzeUpdate } from "./updates";
import { getLLM, PRICE_PER_MTOK, type ResearchStep } from "./ai/llm";
import { firstSentence, overlap, tokens } from "./ai/offline";
import { PermissionError, visibleLevel } from "./permissions";
import { CONNECTOR_LABEL } from "./integrations";

export type TaskKind = "research" | "draft_update" | "review_doc" | "code";
const JOB: Record<TaskKind, string> = { research: "research", draft_update: "draft_update", review_doc: "documents", code: "code" };
export const TASK_KIND_LABEL: Record<string, string> = { research: "Research", draft_update: "Draft update", review_doc: "Document review", code: "Code change" };

export interface Step {
  at: string;
  kind: string;
  text: string;
  by?: string;
  url?: string;
}

async function agentOf(db: Db, unitId: string): Promise<Row> {
  const a = await db.one(`select a.* from app_user a join member m on m.user_id = a.id where m.unit_id = $1 and a.kind = 'agent' and a.id = 'agent_' || $1`, [unitId]);
  if (!a) throw new Error("This team has no agent");
  return a;
}

/** The tools an agent may read: all of its team's, unless the team picked some for it. */
async function connectorFilter(db: Db, agentId: string): Promise<string[] | null> {
  const p = await db.one(`select connector_ids from agent_profile where agent_id = $1`, [agentId]);
  return p && (p.connector_ids as string[]).length ? (p.connector_ids as string[]) : null;
}

async function addStep(db: Db, id: string, step: Omit<Step, "at">) {
  await db.query(`update task_run set steps = steps || $2::jsonb, updated_at = $3 where id = $1`, [id, JSON.stringify([{ at: now().toISOString(), ...step }]), now()]);
}

function assertMember(viewer: Viewer, unitId: string, what: string) {
  if (!viewer.reader.unitIds.includes(unitId)) throw new PermissionError(`Only members of this team can ${what}.`);
}

export async function startTask(db: Db, viewer: Viewer, unitId: string, input: { kind: TaskKind; instructions: string; title?: string; agentId?: string }) {
  if (!workersEnabled()) throw new Error(WORKERS_OFF_MESSAGE);
  assertMember(viewer, unitId, "give its agent work");
  const instructions = input.instructions.trim();
  if (input.kind !== "draft_update" && !instructions) throw new Error(input.kind === "research" ? "Say what to research." : "Say what it should work on.");
  let agent = await agentOf(db, unitId);
  if (input.agentId && input.agentId !== agent.id) {
    // An agent teammate the team created: it must be on this team, and the job must be one of its jobs.
    const custom = await db.one(
      `select a.*, p.actions from app_user a join agent_profile p on p.agent_id = a.id where a.id = $1 and p.unit_id = $2`,
      [input.agentId, unitId],
    );
    if (!custom) throw new PermissionError("That agent isn't on this team.");
    if (!(custom.actions as string[]).includes(JOB[input.kind])) throw new Error(`${custom.name} isn't set up for ${TASK_KIND_LABEL[input.kind].toLowerCase()}.`);
    agent = custom;
  }
  if (Number(agent.spent_usd) >= Number(agent.monthly_budget_usd ?? Infinity))
    throw new Error(`The ${agent.name} has used its $${agent.monthly_budget_usd} monthly budget. A manager can raise it.`);
  const id = newId("tr");
  const title = input.title?.trim() || (input.kind === "draft_update" ? "Draft this week's update from our tools" : firstSentence(instructions).slice(0, 120));
  await db.query(
    `insert into task_run (id, unit_id, agent_id, requested_by, kind, title, instructions, status, steps, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, 'queued', $8, $9, $9)`,
    [id, unitId, agent.id, viewer.user.id, input.kind, title, instructions || title, JSON.stringify([{ at: now().toISOString(), kind: "start", text: `Started for ${viewer.user.name}.` }]), now()],
  );
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "task_start", targetKind: "task", targetId: id, detail: { kind: input.kind, agent: agent.id } });
  return id;
}

/** Runs a queued task to the end. Called in the background after the page responds. */
export async function runTask(db: Db, id: string) {
  const task = await db.one(`select * from task_run where id = $1`, [id]);
  if (!task || task.status !== "queued") return;
  await db.query(`update task_run set status = 'running', updated_at = $2 where id = $1`, [id, now()]);
  try {
    if (task.kind === "draft_update") await runDraftUpdate(db, task);
    else if (task.kind === "review_doc") await runReview(db, task);
    else if (task.kind === "code") await runCode(db, task);
    else await runResearch(db, task);
  } catch (e) {
    await db.query(`update task_run set status = 'failed', error = $2, updated_at = $3 where id = $1`, [id, (e as Error).message.slice(0, 500), now()]);
    await addStep(db, id, { kind: "error", text: `Stopped: ${(e as Error).message.slice(0, 300)}` });
  }
}

async function stillRunning(db: Db, id: string) {
  const t = await db.one(`select status from task_run where id = $1`, [id]);
  return t?.status === "running";
}

async function runDraftUpdate(db: Db, task: Row) {
  const requester = await loadViewer(db, task.requested_by);
  if (!requester) throw new Error("Requester not found");
  const since = addDays(today(), -7);
  const allowed = await connectorFilter(db, task.agent_id);
  const docs = (await db.query(
    `select d.*, c.kind as connector_kind from source_doc d join connector c on c.id = d.connector_id where d.unit_id = $1 and d.occurred_at >= $2 order by d.occurred_at`,
    [task.unit_id, since],
  )).filter((d) => !allowed || allowed.includes(d.connector_id));
  const meetings = await db.query(`select * from meeting where unit_id = $1 and starts_at >= $2 and summary is not null`, [task.unit_id, since]);
  const byKind = (k: string) => docs.filter((d) => d.kind === k).length;
  await addStep(db, task.id, { kind: "read", text: `Read ${byKind("ticket")} tickets, ${byKind("pr")} pull requests, ${byKind("message")} messages and ${byKind("doc")} docs from the last 7 days.` });
  if (meetings.length) await addStep(db, task.id, { kind: "read", text: `Read ${meetings.length} meeting ${meetings.length === 1 ? "summary" : "summaries"}.` });
  // Turn tool activity into plain update lines, then reuse the normal Write update pipeline.
  const lines: string[] = [];
  for (const d of docs) {
    if (d.kind === "ticket" || d.kind === "pr") lines.push(`${d.external_ref} ${d.title} is ${String(d.status ?? "updated").toLowerCase()}. ${firstSentence(d.body)}`);
    else if (d.kind === "message") lines.push(firstSentence(d.body));
  }
  for (const m of meetings) for (const dec of (m.summary.decisions ?? []) as string[]) lines.push(dec);
  if (lines.length === 0) throw new Error("No activity in the team's tools in the last 7 days.");
  if (!(await stillRunning(db, task.id))) return;
  const { updateId, by } = await analyzeUpdate(db, requester, { unitId: task.unit_id, text: lines.join("\n"), source: "agent" });
  const n = (await db.one(`select count(*)::int n from update_item where update_id = $1`, [updateId]))!.n;
  await addStep(db, task.id, { kind: "done", text: `Drafted ${n} update items (${by}). Nothing is shared until ${requester.user.name} reviews and publishes them.` });
  await db.query(`update task_run set status = 'done', output_ref = $2, result_md = $3, sources = $4, updated_at = $5 where id = $1`, [
    task.id,
    updateId,
    `Drafted **${n} update items** from ${docs.length} items in the team's tools${meetings.length ? ` and ${meetings.length} meeting summaries` : ""}.\n\nReview them in Write update before anything reaches other teams.`,
    JSON.stringify(docs.slice(-8).map((d) => ({ title: `${CONNECTOR_LABEL[d.connector_kind] ?? d.connector_kind}: ${d.external_ref ? `${d.external_ref} ` : ""}${d.title}` }))),
    now(),
  ]);
  await audit(db, { orgId: task.org_id, actorId: task.agent_id, onBehalfOfId: task.requested_by, action: "task_done", targetKind: "task", targetId: task.id, detail: { output: updateId } });
}

/** A first-pass review of a document from the team's tools: names, claims and points to check. */
async function runReview(db: Db, task: Row) {
  const allowed = await connectorFilter(db, task.agent_id);
  const docs = (await db.query(
    `select d.*, c.kind as connector_kind, c.name as connector_name from source_doc d join connector c on c.id = d.connector_id where d.unit_id = $1 and d.kind = 'doc' and d.marking_id is null order by d.occurred_at desc`,
    [task.unit_id],
  )).filter((d) => !allowed || allowed.includes(d.connector_id));
  if (docs.length === 0) throw new Error("There are no documents in the tools this agent may read.");
  const q = tokens(task.instructions);
  const doc = docs.map((d) => ({ d, s: overlap(q, tokens(`${d.title} ${d.body}`)) })).sort((a, b) => b.s - a.s)[0].d;
  await addStep(db, task.id, { kind: "read", text: `Opened "${doc.title}" from ${CONNECTOR_LABEL[doc.connector_kind] ?? doc.connector_kind} (${doc.connector_name}) in its sandbox.` });
  const sentences = String(doc.body).split(/(?<=[.!?])\s+/).filter(Boolean);
  const text = `${doc.title}. ${doc.body}`;
  const names = [...new Set((text.match(/\b[A-Z][a-z]+(?: (?:[A-Z][a-z]+|&|of))+\b/g) ?? []).filter((n) => !/^(The|This|From|If|Two|One|Needs|Asks|Lot|Early|Supplier|Contractor) /.test(n)))];
  const money = sentences.filter((x) => /[$€£]\s?\d|\d+(?:,\d{3})* (?:dollars|euros)/.test(x));
  const deadlines = sentences.filter((x) => /\b(by|until|after|before|due)\b[^.]*\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(x));
  const below = sentences.filter((x) => /(against a minimum|below|short of|fail|exceed|over budget|damages|penalt)/i.test(x));
  const disputed = sentences.filter((x) => /(disput|accus|alleg|ban\b|breach|neglect|claim|exclusiv|terminat|not to publish|quote|second source|recording|asks? (?:for|the))/i.test(x));
  const figures = sentences.filter((x) => /\d/.test(x) && !money.includes(x) && !deadlines.includes(x));
  // Other documents in the same tools that touch the same subject, to check against.
  const subject = tokens(`${doc.title} ${doc.body}`);
  const related = docs.filter((d) => d.id !== doc.id).map((d) => ({ d, s: overlap(subject, tokens(`${d.title} ${d.body}`)) })).filter((x) => x.s >= 3).sort((x, y) => y.s - x.s).slice(0, 3);
  await addStep(db, task.id, { kind: "read", text: `Checked ${sentences.length} sentences for names, money, deadlines and disputed points${related.length ? `, and compared it with ${related.length} related ${related.length === 1 ? "document" : "documents"}` : ""}.` });
  const owner = await db.one(`select a.name from member m join app_user a on a.id = m.user_id where m.unit_id = $1 and m.role = 'lead'`, [task.unit_id]);
  const requester = await db.one(`select name from app_user where id = $1`, [task.requested_by]);
  const section = (title: string, xs: string[]) => (xs.length ? ["", `### ${title}`, ...xs.map((x) => `- ${x}`)] : []);
  const md = [
    `## First-pass review: ${doc.title}`,
    "",
    `For ${requester?.name ?? "the team"}${owner && owner.name !== requester?.name ? ` (${owner.name} leads the team)` : ""}. A checklist to speed up the person who signs off. It flags things to check and makes no final calls.`,
    ...section("Below the bar, or at risk", below),
    ...section("Disputed or sensitive points", disputed.filter((x) => !below.includes(x))),
    ...section("Money", money.filter((x) => !below.includes(x) && !disputed.includes(x))),
    ...section("Deadlines", deadlines.filter((x) => !below.includes(x) && !money.includes(x))),
    ...section("Other figures to verify", figures.filter((x) => !below.includes(x) && !disputed.includes(x))),
    ...section("Names and organizations to check", names.slice(0, 10)),
    ...section("Check it against", related.map((x) => `${x.d.title}: ${firstSentence(x.d.body)}`)),
  ].join("\n");
  const flagged = new Set([...below, ...disputed, ...money, ...deadlines]).size;
  await addStep(db, task.id, { kind: "done", text: `Flagged ${flagged} points and ${names.length} names to check. Nothing was sent outside the team.` });
  await db.query(`update task_run set status = 'done', result_md = $2, sources = $3, updated_at = $4 where id = $1`, [
    task.id, md, JSON.stringify([{ title: `${CONNECTOR_LABEL[doc.connector_kind] ?? doc.connector_kind}: ${doc.title}` }]), now(),
  ]);
  await audit(db, { orgId: task.org_id, actorId: task.agent_id, onBehalfOfId: task.requested_by, action: "task_done", targetKind: "task", targetId: task.id, detail: { reviewed: doc.id } });
}

/**
 * Code changes run in an isolated sandbox with a fresh copy of the repository. This demo has no
 * sandbox, so when the demo includes a recorded session for the team it replays that (and says so);
 * otherwise it shows the plan and stops.
 */
async function runCode(db: Db, task: Row) {
  const repo = await db.one(`select name from connector where unit_id = $1 and kind = 'github' order by name limit 1`, [task.unit_id]);
  if (!repo) throw new Error("This team hasn't connected a GitHub repository.");
  await addStep(db, task.id, { kind: "note", text: `Plan: check out ${repo.name} in a fresh sandbox (network limited to GitHub and the package registry), work on a new branch, run the tests and open a pull request. It can't merge.` });
  const demo = await activeDemo(db, task.org_id);
  const { localId } = await import("./scoped");
  const session = demo.ui.sampleSessions[localId(demo.id, task.unit_id)];
  if (!session) {
    await db.query(`update task_run set status = 'needs_sandbox', updated_at = $2 where id = $1`, [task.id, now()]);
    await addStep(db, task.id, { kind: "note", text: "This demo has no code sandbox connected, so nothing was checked out or changed." });
    return;
  }
  await addStep(db, task.id, { kind: "note", text: "Demo replay: this demo has no live sandbox, so these steps replay a recorded session." });
  await addStep(db, task.id, { kind: "read", text: `Checked out ${session.repo} on a new branch, ${session.branch}.` });
  for (const n of session.notes) await addStep(db, task.id, { kind: "read", text: n });
  await addStep(db, task.id, { kind: "done", text: `Opened a pull request from ${session.branch} for review. Nothing was merged.` });
  const md = [
    `## Pull request ready for review`,
    "",
    `**${session.repo}**, branch \`${session.branch}\` (${session.diffstat}).`,
    "",
    "### What changed",
    ...session.notes.map((n) => `- ${n}`),
    "",
    "### Commits",
    ...session.commits.map((c) => `- \`${c}\``),
    "",
    "An engineer on the team reviews and merges it. _Demo replay of a recorded session._",
  ].join("\n");
  await db.query(`update task_run set status = 'done', result_md = $2, sources = $3, updated_at = $4 where id = $1`, [task.id, md, JSON.stringify([{ title: `GitHub: ${session.repo}` }]), now()]);
  await audit(db, { orgId: task.org_id, actorId: task.agent_id, onBehalfOfId: task.requested_by, action: "task_done", targetKind: "task", targetId: task.id, detail: { branch: session.branch, replay: true } });
}

async function runResearch(db: Db, task: Row) {
  const llm = getLLM();
  if (!llm.research) {
    await db.query(`update task_run set status = 'needs_key', updated_at = $2 where id = $1`, [task.id, now()]);
    await addStep(db, task.id, { kind: "note", text: "Research needs a Claude API key (ANTHROPIC_API_KEY). Nothing was sent anywhere." });
    return;
  }
  const agent = await db.one(`select * from app_user where id = $1`, [task.agent_id]);
  if (Number(agent!.spent_usd) >= Number(agent!.monthly_budget_usd ?? Infinity)) throw new Error("Monthly budget reached.");
  const unit = await db.one(`select * from unit where id = $1`, [task.unit_id]);
  const demo = await activeDemo(db);
  // Internal context: the team's own tools, which the requester (a member) may read in full.
  const allowed = await connectorFilter(db, task.agent_id);
  const docs = (await db.query(`select d.*, c.kind as connector_kind from source_doc d join connector c on c.id = d.connector_id where d.unit_id = $1 order by d.occurred_at desc limit 60`, [task.unit_id]))
    .filter((d) => !allowed || allowed.includes(d.connector_id));
  const q = tokens(task.instructions);
  const relevant = docs
    .map((d) => ({ d, s: overlap(q, tokens(`${d.title} ${d.body}`)) }))
    .filter((x) => x.s > 0 && !x.d.marking_id)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6);
  if (relevant.length) await addStep(db, task.id, { kind: "read", text: `Read ${relevant.length} related items from ${unit!.name}'s tools.` });
  const followUps = ((task.steps as Step[]) ?? []).filter((s) => s.kind === "redirect" || s.kind === "comment").map((s) => `${s.by}: ${s.text}`);
  const result = await llm.research(
    {
      system:
        `You are ${agent!.name}, an agent on the ${unit!.name} team at ${demo.org.name}, ${demo.org.about}. ` +
        "A teammate asked you to research something. Use web search for anything external and cite sources inline as markdown links. " +
        "Use the internal context only as background; never invent internal facts. Write a brief for the team: a one-paragraph answer first, " +
        "then findings as bullets, then what you'd recommend and what you couldn't confirm. Use markdown headings sparingly. Under 450 words.",
      prompt:
        `Research request from ${(await loadViewer(db, task.requested_by))?.user.name ?? "a teammate"}:\n${task.instructions}\n\n` +
        (followUps.length ? `Follow-ups from the team:\n${followUps.join("\n")}\n\n` : "") +
        (relevant.length ? `Internal context (${unit!.name}'s tools):\n${relevant.map((x) => `- ${x.d.title}: ${x.d.body}`).join("\n")}` : ""),
    },
    (s: ResearchStep) => {
      void addStep(db, task.id, s);
    },
  );
  if (!(await stillRunning(db, task.id))) return; // taken over or stopped meanwhile
  const cost = (result.inputTokens / 1e6) * PRICE_PER_MTOK.input + (result.outputTokens / 1e6) * PRICE_PER_MTOK.output;
  await db.query(
    `update task_run set status = 'done', result_md = $2, sources = $3, input_tokens = input_tokens + $4, output_tokens = output_tokens + $5, searches = searches + $6, cost_usd = cost_usd + $7, updated_at = $8 where id = $1`,
    [task.id, result.text || "No answer was returned.", JSON.stringify(result.sources), result.inputTokens, result.outputTokens, result.searches, cost.toFixed(4), now()],
  );
  await db.query(`update app_user set spent_usd = spent_usd + $2 where id = $1`, [task.agent_id, cost.toFixed(4)]);
  await addStep(db, task.id, { kind: "done", text: `Wrote a brief from ${result.searches} searches and ${result.sources.length} sources.` });
  await audit(db, { orgId: task.org_id, actorId: task.agent_id, onBehalfOfId: task.requested_by, action: "task_done", targetKind: "task", targetId: task.id, detail: { searches: result.searches, cost_usd: Number(cost.toFixed(4)) } });
}

async function loadVisible(db: Db, viewer: Viewer, id: string) {
  const t = await db.one(`select * from task_run where id = $1`, [id]);
  if (!t) return null;
  const policy = await loadPolicy(db, viewer.orgId);
  return visibleLevel(policy, viewer.reader, refTask(t)).level === "full" ? t : null;
}

export async function getTask(db: Db, viewer: Viewer, id: string) {
  const t = await loadVisible(db, viewer, id);
  if (!t) return null;
  const people = await db.query(`select id, name from app_user where id = any($1)`, [[t.requested_by, t.taken_over_by].filter(Boolean)]);
  return { task: t, requester: people.find((p) => p.id === t.requested_by)?.name, takenOverBy: people.find((p) => p.id === t.taken_over_by)?.name };
}

export async function listTasks(db: Db, viewer: Viewer, unitId: string) {
  if (!viewer.reader.unitIds.includes(unitId)) return [];
  return db.query(`select t.*, a.name as requester_name from task_run t join app_user a on a.id = t.requested_by where t.unit_id = $1 order by t.created_at desc limit 30`, [unitId]);
}

export async function commentTask(db: Db, viewer: Viewer, id: string, text: string) {
  const t = await loadVisible(db, viewer, id);
  if (!t) throw new PermissionError("Only the team can comment on its agent's work.");
  if (!text.trim()) throw new Error("Write a comment first.");
  await addStep(db, id, { kind: "comment", by: viewer.user.name, text: text.trim().slice(0, 1000) });
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "task_comment", targetKind: "task", targetId: id });
}

/** Redirect: add an instruction and run again with everything the team has said so far. */
export async function redirectTask(db: Db, viewer: Viewer, id: string, text: string) {
  const t = await loadVisible(db, viewer, id);
  if (!t) throw new PermissionError("Only the team can redirect its agent's work.");
  if (!text.trim()) throw new Error("Say what to change.");
  if (t.taken_over_by) throw new Error("Someone took this over; start a new task instead.");
  await addStep(db, id, { kind: "redirect", by: viewer.user.name, text: text.trim().slice(0, 1000) });
  await db.query(`update task_run set status = 'queued', instructions = instructions || $2, updated_at = $3 where id = $1`, [id, `\n\nFollow-up from ${viewer.user.name}: ${text.trim()}`, now()]);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "task_redirect", targetKind: "task", targetId: id });
}

export async function takeOverTask(db: Db, viewer: Viewer, id: string) {
  const t = await loadVisible(db, viewer, id);
  if (!t) throw new PermissionError("Only the team can take over its agent's work.");
  await db.query(`update task_run set taken_over_by = $2, status = case when status in ('queued', 'running') then 'stopped' else status end, updated_at = $3 where id = $1`, [id, viewer.user.id, now()]);
  await addStep(db, id, { kind: "takeover", by: viewer.user.name, text: `${viewer.user.name} took this over. The agent stopped.` });
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "task_takeover", targetKind: "task", targetId: id });
}

export function fmtCost(v: unknown) {
  const n = Number(v ?? 0);
  return n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`;
}

export { fmt };
