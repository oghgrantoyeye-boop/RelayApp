// Talking to agents. Every person has their own agent ("Your Beacon agent"), which works out which
// team a question belongs to, and can message any team's agent or any agent teammate directly.
// Answers come from what teams published, read at the asker's level, with sources. Anything an
// agent wants to do (start a draft, notify someone now, run research) is proposed as an action
// the person approves first.
import type { Db, Row } from "./db";
import { fmt, now } from "./clock";
import { audit, newId, type Viewer } from "./data";
import { askTeam, getQuestion } from "./agent";
import { search } from "./directory";
import { getFeed } from "./feed";
import { commitmentViews } from "./commitments";
import { deliver } from "./deliver";
import { getAgent, listAgents, type AgentRow } from "./agents";
import { workersEnabled, WORKERS_OFF_MESSAGE } from "./flags";
import { PermissionError } from "./permissions";

export type ChatTarget = "me" | string; // "me", or an agent's user id

export interface ChatRef { label: string; href: string; detail?: string }
export interface ChatAction {
  id: string;
  kind: "draft_update" | "nudge" | "research" | "review_doc" | "code";
  label: string;
  detail: string;
  args: Record<string, string>;
  status: "proposed" | "approved" | "dismissed";
  result?: string;
  href?: string;
}
export interface ChatMsg {
  id: string;
  role: "user" | "agent";
  target: string;
  agentLabel: string | null;
  text: string;
  refs: ChatRef[];
  actions: ChatAction[];
  at: string;
}

const MY_AGENT = "Your Beacon agent";

function toMsg(r: Row): ChatMsg {
  return { id: r.id, role: r.role, target: r.target, agentLabel: r.agent_label, text: r.text, refs: r.refs ?? [], actions: r.actions ?? [], at: new Date(r.created_at).toISOString() };
}

export async function conversation(db: Db, viewer: Viewer, target: ChatTarget, limit = 40): Promise<ChatMsg[]> {
  const rows = await db.query(`select * from chat_message where user_id = $1 and target = $2 order by created_at desc, id desc limit $3`, [viewer.user.id, target, limit]);
  return rows.reverse().map(toMsg);
}

/** The people's agents list for the chat view: yours first, then your teams' agents, then the rest. */
export async function chatContacts(db: Db, viewer: Viewer) {
  const agents = await listAgents(db);
  const last = await db.query(`select target, max(created_at) as at from chat_message where user_id = $1 group by target`, [viewer.user.id]);
  const lastAt = new Map(last.map((r) => [r.target, new Date(r.at).toISOString()]));
  const mine = agents.filter((a) => viewer.reader.unitIds.includes(a.team.id));
  const others = agents.filter((a) => !viewer.reader.unitIds.includes(a.team.id));
  return { mine, others, lastAt };
}

async function save(db: Db, viewer: Viewer, m: Omit<ChatMsg, "id" | "at">) {
  const id = newId("ch");
  await db.query(
    `insert into chat_message (id, org_id, user_id, role, target, agent_label, text, refs, actions, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, viewer.orgId, viewer.user.id, m.role, m.target, m.agentLabel, m.text, JSON.stringify(m.refs), JSON.stringify(m.actions), new Date(now().getTime() + (m.role === "agent" ? 1 : 0))],
  );
  return id;
}

/** "@Legal prep what's flagged?" talks to that agent. Matches the start of an agent's name. */
export async function resolveMention(db: Db, text: string): Promise<{ agent: AgentRow; rest: string } | null> {
  const m = text.match(/^@(.+)$/s);
  if (!m) return null;
  const body = m[1].toLowerCase();
  const agents = await listAgents(db);
  let best: { agent: AgentRow; len: number } | null = null;
  for (const a of agents) {
    for (const name of [a.name.toLowerCase(), a.name.toLowerCase().replace(/ agent$/, ""), a.team.name.toLowerCase()]) {
      if (body.startsWith(name) && (!best || name.length > best.len)) best = { agent: a, len: name.length };
    }
  }
  return best ? { agent: best.agent, rest: m[1].slice(best.len).replace(/^[\s,:]+/, "") } : null;
}

const ATTENTION = /(needs? my attention|at risk|what changed|what('?s| is) (new|late|slipping|changing)|catch me up|my week|anything i should know|what should i (look at|know))/i;
const OWED = /(what do (i|we) owe|my commitments|our commitments|what('?s| is) due)/i;
const DRAFT = /(draft|write).*(update|weekly)/i;
const WHO = /^who (owns|handles|knows|is responsible for|should i ask about)\s+(.+?)\??$/i;
const RESEARCH = /^(research|look into|find out)\b/i;
const REVIEW = /\b(review|redline|check the draft|go through)\b/i;
const CODE = /\b(fix|bug|pull request|refactor|implement|patch|code)\b/i;

/** Send a message to an agent and get its reply. */
export async function sendChat(db: Db, viewer: Viewer, input: { target: ChatTarget; text: string }): Promise<string> {
  let text = input.text.trim().slice(0, 2000);
  if (!text) throw new Error("Type a message first.");
  let target = input.target || "me";
  const mention = await resolveMention(db, text);
  if (mention) {
    target = mention.agent.id;
    text = mention.rest || text;
  }
  const agent = target === "me" ? null : await getAgent(db, target);
  if (target !== "me" && !agent) throw new Error("That agent doesn't exist.");
  await save(db, viewer, { role: "user", target, agentLabel: null, text: input.text.trim().slice(0, 2000), refs: [], actions: [] });
  const reply = await replyTo(db, viewer, agent, text);
  return save(db, viewer, { role: "agent", target, agentLabel: agent ? agent.name : MY_AGENT, ...reply });
}

type Reply = { text: string; refs: ChatRef[]; actions: ChatAction[] };
const action = (kind: ChatAction["kind"], label: string, detail: string, args: Record<string, string>): ChatAction => ({ id: newId("act"), kind, label, detail, args, status: "proposed" });

async function replyTo(db: Db, viewer: Viewer, agent: AgentRow | null, text: string): Promise<Reply> {
  const inTeam = agent ? viewer.reader.unitIds.includes(agent.team.id) : true;
  const can = (a: string) => !agent || agent.actions.includes(a);

  if (!agent && ATTENTION.test(text)) return attention(db, viewer);
  if (!agent && OWED.test(text)) return owed(db, viewer);

  const who = text.match(WHO);
  if (who) {
    const r = await search(db, who[2], viewer.orgId);
    const t = r.teams.find((x) => Object.keys(x.team.how_to_ask ?? {}).length > 0);
    if (!t) return { text: `I couldn't find a team that owns "${who[2]}". Try the directory.`, refs: [{ label: "Directory", href: `/directory?q=${encodeURIComponent(who[2])}` }], actions: [] };
    return { text: `${t.team.name}. ${t.why}. You can ask its agent here, or @mention it.`, refs: [{ label: t.team.name, href: `/teams/${t.team.slug}` }], actions: [] };
  }

  // Work-performing agents are deferred (see src/lib/flags.ts): say so instead of offering a job.
  if (!workersEnabled() && (DRAFT.test(text) || RESEARCH.test(text))) {
    const team = agent?.team ?? viewer.units.find((u) => Object.keys(u.how_to_ask ?? {}).length > 0);
    return {
      text: `${WORKERS_OFF_MESSAGE} Ask me what a team owns, knows or is working on, and I'll answer with sources or ask the team for you.`,
      refs: team ? [{ label: team.name, href: `/teams/${team.slug}` }] : [],
      actions: [],
    };
  }

  if (workersEnabled() && DRAFT.test(text)) {
    const unit = agent && inTeam ? agent.team : viewer.units.find((u) => Object.keys(u.how_to_ask ?? {}).length > 0);
    if (!unit || !inTeam) return { text: `Only ${agent?.team.name ?? "the team"} can ask its agent to draft an update.`, refs: [], actions: [] };
    if (!can("draft_update")) return { text: `Drafting updates isn't one of my jobs. ${agent!.team.name}'s lead can change that on my profile.`, refs: [{ label: "Profile", href: `/agents/${agent!.team.slug}?agent=${agent!.id}` }], actions: [] };
    return {
      text: `I can read ${unit.name}'s tools from the last 7 days and draft the update. Nothing is shared until you review and publish it.`,
      refs: [],
      actions: [action("draft_update", "Start the draft", `Reads ${unit.name}'s connected tools and writes draft items for you to review.`, { unitId: unit.id, agentId: agent?.id ?? "" })],
    };
  }

  if (workersEnabled() && agent && inTeam && can("documents") && REVIEW.test(text)) {
    return {
      text: "I'll open the document in my sandbox and write a first-pass checklist: names, figures that need a source, and points to check. I don't make the final call, and nothing leaves the team.",
      refs: [],
      actions: [action("review_doc", "Start the review", `Reads only the tools ${agent.team.name} picked for me.`, { unitId: agent.team.id, agentId: agent.id, instructions: text })],
    };
  }

  if (workersEnabled() && agent && inTeam && can("code") && CODE.test(text)) {
    return {
      text: "I'll check out the repository in a fresh sandbox, make the change on a new branch, run the tests and open a pull request. I can't merge; an engineer reviews it.",
      refs: [],
      actions: [action("code", "Start the change", `Works on a copy of ${agent.team.name}'s repository. $${(agent.budget - agent.spent).toFixed(0)} left this month.`, { unitId: agent.team.id, agentId: agent.id, instructions: text })],
    };
  }

  if (workersEnabled() && RESEARCH.test(text) && agent && inTeam) {
    if (!can("research")) return { text: "Research isn't one of my jobs.", refs: [], actions: [] };
    return {
      text: "I'll research that and write a brief with sources. It costs a little of my monthly budget, so I'll wait for your go-ahead.",
      refs: [],
      actions: [action("research", "Run the research", `Uses web search and ${agent.team.name}'s tools. $${(agent.budget - agent.spent).toFixed(0)} left this month.`, { unitId: agent.team.id, agentId: agent.id, instructions: text })],
    };
  }

  // A question: ask the right team's agent, at the asker's level.
  let unitId = agent?.team.id;
  let via = "";
  if (!unitId) {
    const r = await search(db, text, viewer.orgId);
    const t = r.teams.find((x) => Object.keys(x.team.how_to_ask ?? {}).length > 0);
    if (!t) {
      return {
        text: "I couldn't tell which team this belongs to. Try \"who owns …\", or pick a team's agent on the left.",
        refs: [],
        actions: [],
      };
    }
    unitId = t.team.id;
    via = t.why.startsWith("Owns ") ? `${t.team.name} owns ${t.why.slice(5)}, so I asked its agent. ` : `This sounds like ${t.team.name}'s area, so I asked its agent. `;
  }
  if (agent && !can("answer")) return { text: `Answering questions isn't one of my jobs. Ask the ${agent.team.name} agent instead.`, refs: [], actions: [] };
  const teamId: string = unitId!;
  const { questionId } = await askTeam(db, viewer, teamId, text);
  const q = await getQuestion(db, viewer, questionId);
  const unit = (await db.one(`select name, slug from unit where id = $1`, [teamId]))!;
  if (!q) return { text: `${via}The answer draws on something you aren't cleared to see, so I can't share it.`, refs: [], actions: [] };
  const refs: ChatRef[] = q.sources.map((s) => ({ label: `${unit.name}: ${s.label}`, href: `/teams/${unit.slug}`, detail: s.text }));
  if (q.question.outcome === "answered") return { text: `${via}${q.question.answer_text}`, refs, actions: [] };
  const req = await db.one(
    `select r.id, r.urgency, a.name as assignee from request r join member m on m.id = r.assignee_member_id join app_user a on a.id = m.user_id where r.id = $1`,
    [q.question.request_id],
  );
  const actions = req && req.urgency !== "blocking"
    ? [action("nudge", `Ask ${String(req.assignee).split(" ")[0]} to look sooner`, `Marks your question blocking and notifies ${req.assignee} now instead of in their next batch.`, { requestId: req.id })]
    : [];
  return { text: `${via}${q.question.answer_text}`, refs: [...refs, { label: "Your asks", href: "/asks" }], actions };
}

async function attention(db: Db, viewer: Viewer): Promise<Reply> {
  const feed = await getFeed(db, viewer);
  const lines: string[] = [];
  for (const a of feed.alerts.slice(0, 4)) {
    const why = a.state === "slipped"
      ? `was due ${fmt(a.due)}, and ${a.ownerUnit.name} is working out a new date${a.shown.reason ? ` (${a.shown.reason.replace(/\.$/, "")})` : ""}`
      : `is waiting on ${a.blockedBy ? `${a.blockedBy.ownerUnit.name}'s "${a.blockedBy.shown.title}"` : "another team"}, so its date may move`;
    lines.push(`- **${a.shown.title}** (${a.ownerUnit.name}) ${why}.`);
  }
  for (const k of feed.asksForYou.slice(0, 2)) lines.push(`- ${k.team.name} asked your team: ${k.text}`);
  for (const d of feed.decisions.slice(0, 2)) lines.push(`- ${d.team.name} decided: ${d.text}`);
  if (lines.length === 0) return { text: "Nothing has changed for you. Every date your teams depend on is holding.", refs: [{ label: "My feed", href: "/feed" }], actions: [] };
  return { text: `Here's what changed for you this week:\n${lines.join("\n")}`, refs: [{ label: "My feed", href: "/feed" }, { label: "Commitments", href: "/commitments" }], actions: [] };
}

async function owed(db: Db, viewer: Viewer): Promise<Reply> {
  const mine = await commitmentViews(db, viewer.reader, (r) => r.status === "open" && viewer.reader.unitIds.includes(r.owner_unit_id));
  if (mine.length === 0) return { text: "Your teams have no open commitments.", refs: [], actions: [] };
  const lines = mine.slice(0, 6).map((c) => `- **${c.shown.title}**, due ${fmt(c.due)}${c.waitingUnit ? ` for ${c.waitingUnit.name}` : ""} (${c.state.replace("_", " ")})`);
  return { text: `Your teams owe:\n${lines.join("\n")}`, refs: [{ label: "Commitments", href: "/commitments" }], actions: [] };
}

/** Approve or dismiss an action an agent proposed. Only the person it was proposed to can. */
export async function decideAction(db: Db, viewer: Viewer, messageId: string, actionId: string, approve: boolean): Promise<{ href?: string; taskId?: string }> {
  const m = await db.one(`select * from chat_message where id = $1`, [messageId]);
  if (!m || m.user_id !== viewer.user.id) throw new PermissionError("That isn't your conversation.");
  const actions: ChatAction[] = m.actions ?? [];
  const a = actions.find((x) => x.id === actionId);
  if (!a || a.status !== "proposed") throw new Error("That action was already handled.");
  let out: { href?: string; taskId?: string } = {};
  if (!approve) a.status = "dismissed";
  else {
    const w = await import("./work");
    if (a.kind === "draft_update" || a.kind === "research" || a.kind === "review_doc" || a.kind === "code") {
      const taskId = await w.startTask(db, viewer, a.args.unitId, { kind: a.kind, instructions: a.args.instructions ?? "", agentId: a.args.agentId || undefined });
      const slug = (await db.one(`select slug from unit where id = $1`, [a.args.unitId]))!.slug;
      a.href = `/agents/${slug}/tasks/${taskId}`;
      a.result = { draft_update: "Started. The draft will be in Write update for you to review.", research: "Started. The brief will be on the task page.", review_doc: "Started. The checklist will be on the task page.", code: "Started. Follow it on the task page." }[a.kind];
      out = { href: a.href, taskId };
    } else if (a.kind === "nudge") {
      const r = await db.one(`select r.*, m.user_id as assignee_id from request r join member m on m.id = r.assignee_member_id where r.id = $1`, [a.args.requestId]);
      if (!r || r.requester_id !== viewer.user.id) throw new PermissionError("Only the person who asked can do that.");
      await db.query(`update request set urgency = 'blocking', delivery = 'immediate', delivered_at = $2 where id = $1`, [r.id, now()]);
      await deliver(db, [r.assignee_id], { kind: "ask_now", subject: `Blocking ask from ${viewer.user.name}`, body: r.title, refs: [{ type: "request", id: r.id, href: "/asks" }] });
      a.result = "Done. They've been notified now.";
    }
    a.status = "approved";
  }
  await db.query(`update chat_message set actions = $2 where id = $1`, [messageId, JSON.stringify(actions)]);
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: approve ? "agent_action_approved" : "agent_action_dismissed", targetKind: "chat", targetId: messageId, detail: { kind: a.kind } });
  return out;
}
