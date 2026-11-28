// Talking to agents. Every person has their own agent ("Your Beacon agent"), which works out which
// team a question belongs to, and can message any team's agent or any agent teammate directly.
// Answers come from what teams published, read at the asker's level, with sources. Anything an
// agent wants to do (start a draft, notify someone now, run research) is proposed as an action
// the person approves first.
import type { Db, Row } from "./db";
import { fmt, now } from "./clock";
import { audit, newId, type Viewer } from "./data";
import { askTeam, askTeams, continueQuestion, getQuestion, type ClaimView } from "./agent";
import { search } from "./directory";
import { getFeed } from "./feed";
import { commitmentViews } from "./commitments";
import { deliver } from "./deliver";
import { getAgent, listAgents, type AgentRow } from "./agents";
import { workersEnabled, WORKERS_OFF_MESSAGE } from "./flags";
import { PermissionError } from "./permissions";
import { learnQuietly } from "./context-learn";
import { getLLM } from "./ai/llm";

export type ChatTarget = "me" | string; // "me", or an agent's user id

export interface ChatRef { label: string; href: string; detail?: string }
/**
 * A follow-up the agent asked. Either about a team's question (questionId), or, from your own agent,
 * which of two teams you mean (teamIds, with the original text to ask once you pick).
 */
export interface ChatClarify {
  question: string;
  options: string[];
  questionId?: string;
  teamIds?: string[];
  original?: string;
  /** T-27: the asker can send to more than one of teamIds ("Both", "All three", or several names). */
  multi?: boolean;
  /** Set once the asker replied, so a later message isn't taken as the reply. */
  done?: boolean;
}
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
  /** A team agent's answer, claim by claim (T-19), and at most one follow-up question (T-20). */
  answer?: { claims: ClaimView[]; gaps: string[]; clarify?: ChatClarify; questionId?: string; vote?: "up" | "down" | null };
  at: string;
}

const MY_AGENT = "Your Beacon agent";

function toMsg(r: Row): ChatMsg {
  return { id: r.id, role: r.role, target: r.target, agentLabel: r.agent_label, text: r.text, refs: r.refs ?? [], actions: r.actions ?? [], answer: r.answer ?? undefined, at: new Date(r.created_at).toISOString() };
}

export async function conversation(db: Db, viewer: Viewer, target: ChatTarget, limit = 40): Promise<ChatMsg[]> {
  const rows = await db.query(`select * from chat_message where user_id = $1 and target = $2 order by created_at desc, id desc limit $3`, [viewer.user.id, target, limit]);
  const msgs = rows.reverse().map(toMsg);
  // T-21: show whether you already rated each agent answer.
  const ids = msgs.map((m) => m.answer?.questionId).filter((x): x is string => !!x);
  if (ids.length > 0) {
    const votes = await db.query(`select question_id, vote from answer_feedback where user_id = $1 and question_id = any($2)`, [viewer.user.id, ids]);
    const by = new Map(votes.map((v) => [v.question_id as string, v.vote as "up" | "down"]));
    for (const m of msgs) if (m.answer?.questionId) m.answer.vote = by.get(m.answer.questionId) ?? null;
  }
  return msgs;
}

/** The people's agents list for the chat view: yours first, then your teams' agents, then the rest. */
export async function chatContacts(db: Db, viewer: Viewer) {
  const agents = await listAgents(db, viewer.orgId);
  const last = await db.query(`select target, max(created_at) as at from chat_message where user_id = $1 group by target`, [viewer.user.id]);
  const lastAt = new Map(last.map((r) => [r.target, new Date(r.at).toISOString()]));
  const mine = agents.filter((a) => viewer.reader.unitIds.includes(a.team.id));
  const others = agents.filter((a) => !viewer.reader.unitIds.includes(a.team.id));
  return { mine, others, lastAt };
}

async function save(db: Db, viewer: Viewer, m: Omit<ChatMsg, "id" | "at">) {
  const id = newId("ch");
  await db.query(
    `insert into chat_message (id, org_id, user_id, role, target, agent_label, text, refs, actions, answer, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, viewer.orgId, viewer.user.id, m.role, m.target, m.agentLabel, m.text, JSON.stringify(m.refs), JSON.stringify(m.actions), m.answer ? JSON.stringify(m.answer) : null, new Date(now().getTime() + (m.role === "agent" ? 1 : 0))],
  );
  return id;
}

/** "@Legal prep what's flagged?" talks to that agent. Matches the start of an agent's name. */
export async function resolveMention(db: Db, orgId: string, text: string): Promise<{ agent: AgentRow; rest: string } | null> {
  const m = text.match(/^@(.+)$/s);
  if (!m) return null;
  const body = m[1].toLowerCase();
  const agents = await listAgents(db, orgId);
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
/** Small talk: a greeting or thanks on its own, not a question about anyone's work. */
const GREETING = /^(hi|hello|hey|hiya|yo|howdy|good (morning|afternoon|evening)|thanks?( you)?|thx|cheers|ok(ay)?|cool|great)( there| beacon)?[\s!.?]*$/i;
const HELP = /^(help|\?|what can (you|i) do|what do you do|who are you|what are you|what is (this|beacon)|how (does|do) (this|beacon|you) work|how do i (use|start)( this| beacon)?)[\s!.?]*$/i;
const REVIEW = /\b(review|redline|check the draft|go through)\b/i;
const CODE = /\b(fix|bug|pull request|refactor|implement|patch|code)\b/i;

/** Send a message to an agent and get its reply. */
export async function sendChat(db: Db, viewer: Viewer, input: { target: ChatTarget; text: string; replyTo?: string }): Promise<string> {
  let text = input.text.trim().slice(0, 2000);
  if (!text) throw new Error("Type a message first.");
  let target = input.target || "me";
  const mention = await resolveMention(db, viewer.orgId, text);
  if (mention) {
    target = mention.agent.id;
    text = mention.rest || text;
  }
  const agent = target === "me" ? null : await getAgent(db, target, viewer.orgId);
  if (target !== "me" && !agent) throw new Error("That agent doesn't exist.");
  const userMsgId = await save(db, viewer, { role: "user", target, agentLabel: null, text: input.text.trim().slice(0, 2000), refs: [], actions: [] });
  // A teammate talking to their own team's agent is the team describing itself. Someone from another
  // team asking a question is not, so Beacon only learns from members of the agent's team.
  if (agent && viewer.reader.unitIds.includes(agent.team.id))
    await learnQuietly(db, { unitId: agent.team.id, kind: "agent_chat", ref: userMsgId, label: `${viewer.user.name} in ${agent.name}`, text, actorId: viewer.user.id });
  const pending = await pendingClarify(db, viewer, target, text, input.replyTo);
  const reply = pending ? await replyToClarify(db, viewer, pending, text) : await replyTo(db, viewer, agent, text);
  let last = "";
  for (const r of Array.isArray(reply) ? reply : [reply]) last = await save(db, viewer, { role: "agent", target, agentLabel: agent ? agent.name : MY_AGENT, ...r });
  return last;
}

type Reply = { text: string; refs: ChatRef[]; actions: ChatAction[]; answer?: ChatMsg["answer"] };
const action = (kind: ChatAction["kind"], label: string, detail: string, args: Record<string, string>): ChatAction => ({ id: newId("act"), kind, label, detail, args, status: "proposed" });

async function replyTo(db: Db, viewer: Viewer, agent: AgentRow | null, text: string): Promise<Reply> {
  const inTeam = agent ? viewer.reader.unitIds.includes(agent.team.id) : true;
  const can = (a: string) => !agent || agent.actions.includes(a);

  if (GREETING.test(text.trim()) || HELP.test(text.trim())) return intro(db, viewer, agent, HELP.test(text.trim()));
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
    if (!t) return noTeamFound(db, viewer, text);
    const askable = r.teams.filter((x) => Object.keys(x.team.how_to_ask ?? {}).length > 0);
    const close = closeTeams(askable);
    if (close.length >= 2) {
      const names = close.map((x) => x.team.name);
      const all = close.length === 2 ? "Both" : `All ${close.length}`;
      return {
        text: `This could be ${listNames(names, "or")}. Which should I ask? I can ask ${close.length === 2 ? "both" : "all of them"} and keep it as one question.`,
        refs: [],
        actions: [],
        answer: { claims: [], gaps: [], clarify: { question: "", options: [...names, all], teamIds: close.map((x) => x.team.id), original: text, multi: true } },
      };
    }
    unitId = t.team.id;
    via = t.why.startsWith("Owns ") ? `${t.team.name} owns ${t.why.slice(5)}, so I asked its agent. ` : `This sounds like ${t.team.name}'s area, so I asked its agent. `;
  }
  if (agent && !can("answer")) return { text: `Answering questions isn't one of my jobs. Ask the ${agent.team.name} agent instead.`, refs: [], actions: [] };
  const { questionId } = await askTeam(db, viewer, unitId!, text);
  return replyForQuestion(db, viewer, questionId, via);
}

/** Teams in the workspace someone could ask, other than the viewer's own. */
async function otherTeams(db: Db, viewer: Viewer): Promise<Row[]> {
  const units = await db.query(`select id, name, slug from unit where org_id = $1 and how_to_ask <> '{}'::jsonb order by name`, [viewer.orgId]);
  return units.filter((u) => !viewer.reader.unitIds.includes(u.id));
}

/** Setup steps for a workspace that has nothing to ask yet. */
function setupRefs(viewer: Viewer): Reply["refs"] {
  return [
    { label: "Connect GitHub or Claude Code", href: "/connect" },
    { label: "Write a first update", href: "/write" },
    { label: "Invite people", href: "/workspace/people" },
    ...(viewer.team ? [{ label: viewer.team.name, href: `/teams/${viewer.team.slug}` }] : []),
  ];
}

/** A greeting or "what can you do?": say what this agent does, and what to try first. */
async function intro(db: Db, viewer: Viewer, agent: AgentRow | null, asked: boolean): Promise<Reply> {
  const first = viewer.user.name.split(" ")[0];
  if (agent) {
    const mine = viewer.reader.unitIds.includes(agent.team.id);
    return {
      text: mine
        ? `Hi ${first}. I'm ${agent.name}. I answer other teams' questions about ${agent.team.name} from what the team has shared, and send the rest to the right person. Ask me what we own or what we're working on, or "Draft our weekly update".`
        : `Hi ${first}. I'm ${agent.name}. Ask me anything about ${agent.team.name}'s work. I answer from what the team has shared at your level of access, and if I don't know, I ask the right person on the team for you.`,
      refs: [{ label: agent.team.name, href: `/teams/${agent.team.slug}` }],
      actions: [],
    };
  }
  const others = await otherTeams(db, viewer);
  if (others.length === 0) {
    return {
      text:
        `${asked ? "" : `Hi ${first}. `}I'm your Beacon agent. I keep track of what each team or project is doing and answer questions about it, with sources. ` +
        "Your workspace is new, so there's not much for me to go on yet. Connect GitHub or Claude Code so I can learn from your work as it happens, or write a first update. " +
        "If other people work with you, invite them and I'll route their questions to the right owner.",
      refs: setupRefs(viewer),
      actions: [],
    };
  }
  const names = others.slice(0, 3).map((u) => u.name);
  return {
    text:
      `${asked ? "" : `Hi ${first}. `}I'm your Beacon agent. Ask me about any team's work and I'll find who owns it, answer from what they've shared at your level of access, and send anything new to the right person. ` +
      `Try "What changed for me this week?" or "Who owns …?", or ask ${listNames(names, "or")} directly.`,
    refs: others.slice(0, 3).map((u) => ({ label: u.name, href: `/teams/${u.slug}` })),
    actions: [],
  };
}

const CHAT_SCHEMA = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"], additionalProperties: false };

/**
 * Nothing in the workspace matches. With a model, reply normally and say what Beacon couldn't find;
 * without one, say so and suggest what to try, instead of a dead end.
 */
async function noTeamFound(db: Db, viewer: Viewer, text: string): Promise<Reply> {
  const others = await otherTeams(db, viewer);
  const refs = others.length === 0 ? setupRefs(viewer) : [{ label: "Browse teams", href: "/directory" }];
  const teams = others.map((u) => u.name).join(", ") || "none yet besides your own";
  const got = await getLLM().json<{ reply: string }>("chat_reply", {
    system:
      `You are Beacon, a workplace assistant for ${viewer.user.name}. Beacon tracks what each team or project does and answers questions from what they've shared. ` +
      `Teams in this workspace: ${teams}. None of them matched this message, so you have no workspace facts to use. ` +
      "Reply helpfully and briefly (under 90 words), in plain sentences. Never invent facts about the workspace, its people or its work. " +
      "If the message is about the workspace's work, say you couldn't find a team that covers it and suggest asking \"who owns …\" or connecting tools.",
    prompt: text,
    schema: CHAT_SCHEMA,
    maxTokens: 600,
  });
  if (got?.reply?.trim()) return { text: got.reply.trim(), refs, actions: [] };
  return {
    text:
      others.length === 0
        ? "I couldn't find anything about that yet. Your workspace is new, so connect GitHub or Claude Code, or write a first update, and I'll have something to answer from."
        : `I couldn't find a team that covers that. Try "who owns …", ask one of ${listNames(others.slice(0, 3).map((u) => u.name), "or")} directly, or browse the teams.`,
    refs,
    actions: [],
  };
}

/** Two teams match about equally: ask which one rather than guess. */
/** The teams close enough to the best match that Beacon should ask which one (at most three). */
function closeTeams<T extends { team: Row; score: number }>(teams: T[]): T[] {
  if (teams.length < 2) return teams.slice(0, 1);
  const top = teams[0].score;
  return [teams[0], ...teams.slice(1, 3).filter((t) => t.score >= 3 && t.score >= 0.7 * top)];
}

function listNames(names: string[], joiner: "and" | "or"): string {
  return names.length <= 2 ? names.join(` ${joiner} `) : `${names.slice(0, -1).join(", ")} ${joiner} ${names[names.length - 1]}`;
}

/** Which of the offered teams a reply picks: "both"/"all" picks every one, otherwise each named team. */
export function pickedTeams<T extends { name: string }>(teams: T[], text: string, multi: boolean): T[] {
  const lower = text.toLowerCase().trim();
  if (multi && /^(both|all\b.*|all of them|everyone|each)[.!]?$/.test(lower)) return teams;
  const named = teams.filter((t) => lower.includes(String(t.name).toLowerCase()));
  if (named.length > 0) return multi ? named : named.slice(0, 1);
  const one = teams.find((t) => lower.length > 0 && String(t.name).toLowerCase().includes(lower));
  return one ? [one] : [];
}

/** How an agent's answer, follow-up or routing reads in the chat. */
async function replyForQuestion(db: Db, viewer: Viewer, questionId: string, via: string): Promise<Reply> {
  const q = await getQuestion(db, viewer, questionId);
  if (!q) return { text: `${via}The answer draws on something you aren't cleared to see, so I can't share it.`, refs: [], actions: [] };
  const unit = (await db.one(`select name, slug from unit where id = $1`, [q.question.unit_id]))!;
  const refs: ChatRef[] = q.sources.map((s) => ({ label: `${unit.name}: ${s.label}`, href: `/teams/${unit.slug}`, detail: s.text }));
  const clarify: ChatClarify | undefined = q.clarify ? { ...q.clarify, questionId } : undefined;
  if (q.question.outcome === "clarify") {
    return { text: `${via}One question so I get this to the right place: ${q.clarify!.question}`, refs: [], actions: [], answer: { claims: [], gaps: [], clarify: { ...clarify!, question: "" } } };
  }
  if (q.question.outcome === "answered") {
    if (q.claims.length > 0) return { text: `${via}Here's what ${unit.name} has shared that answers this.`, refs, actions: [], answer: { claims: q.claims, gaps: q.gaps, clarify, questionId } };
    return { text: `${via}${q.question.answer_text}`, refs, actions: [] };
  }
  const req = await db.one(
    `select r.id, r.urgency, a.name as assignee from request r join member m on m.id = r.assignee_member_id join app_user a on a.id = m.user_id where r.id = $1`,
    [q.question.request_id],
  );
  const actions = req && req.urgency !== "blocking"
    ? [action("nudge", `Ask ${String(req.assignee).split(" ")[0]} to look sooner`, `Marks your question blocking and notifies ${req.assignee} now instead of in their next batch.`, { requestId: req.id })]
    : [];
  return { text: `${via}${q.question.answer_text}`, refs: [...refs, { label: "Track it in My questions", href: `/questions?open=${encodeURIComponent(q.question.request_id ?? questionId)}` }], actions, answer: q.claims.length || q.gaps.length ? { claims: q.claims, gaps: q.gaps } : undefined };
}

/**
 * Whether this message replies to the agent's open follow-up in this conversation: it was sent from
 * the follow-up's buttons, or it's one of the suggested replies, or it's short and not a new question.
 */
async function pendingClarify(db: Db, viewer: Viewer, target: string, text: string, replyTo?: string): Promise<{ messageId: string; clarify: ChatClarify } | null> {
  const last = replyTo
    ? await db.one(`select id, answer from chat_message where id = $1 and user_id = $2 and target = $3 and role = 'agent'`, [replyTo, viewer.user.id, target])
    : await db.one(`select id, answer from chat_message where user_id = $1 and target = $2 and role = 'agent' order by created_at desc, id desc limit 1`, [viewer.user.id, target]);
  const clarify = last?.answer?.clarify as ChatClarify | undefined;
  if (!last || !clarify || clarify.done) return null;
  const picked = clarify.options.some((o) => o.toLowerCase() === text.toLowerCase());
  // After an answer that also asked something, only a picked reply counts: "thanks" isn't an answer.
  const onlyAsked = !(last.answer.claims ?? []).length;
  const shortReply = onlyAsked && text.split(/\s+/).length <= 8 && !text.includes("?");
  return replyTo || picked || shortReply ? { messageId: last.id, clarify } : null;
}

async function replyToClarify(db: Db, viewer: Viewer, pending: { messageId: string; clarify: ChatClarify }, text: string): Promise<Reply | Reply[]> {
  const { clarify } = pending;
  const m = (await db.one(`select answer from chat_message where id = $1`, [pending.messageId]))!;
  await db.query(`update chat_message set answer = $2 where id = $1`, [pending.messageId, JSON.stringify({ ...m.answer, clarify: { ...clarify, done: true } })]);
  if (clarify.teamIds?.length) {
    const teams = await db.query(`select id, name from unit where id = any($1)`, [clarify.teamIds]);
    const ordered = clarify.teamIds.map((id) => teams.find((t) => t.id === id)).filter((t): t is Row => !!t) as { id: string; name: string }[];
    const picked = pickedTeams(ordered, text, !!clarify.multi);
    if (picked.length === 0) return { text: `I'll leave it there. Ask again and name the team, or pick its agent on the left.`, refs: [], actions: [] };
    if (picked.length === 1) {
      const { questionId } = await askTeam(db, viewer, picked[0].id, clarify.original ?? text, { noClarify: true });
      return replyForQuestion(db, viewer, questionId, `Thanks. I asked the ${picked[0].name} agent. `);
    }
    // T-27: one question, several teams. Each team's reply is its own message so each can be rated.
    const { questionIds } = await askTeams(db, viewer, picked.map((t) => t.id), clarify.original ?? text);
    const names = listNames(picked.map((t) => t.name), "and");
    const replies: Reply[] = [];
    for (const [i, qid] of questionIds.entries()) {
      replies.push(await replyForQuestion(db, viewer, qid, i === 0 ? `Thanks. I asked ${names} and linked them as one question in My questions. **${picked[i].name}:** ` : `**${picked[i].name}:** `));
    }
    return replies;
  }
  const { questionId } = await continueQuestion(db, viewer, clarify.questionId!, text);
  return replyForQuestion(db, viewer, questionId, "Thanks. ");
}

async function attention(db: Db, viewer: Viewer): Promise<Reply> {
  const feed = await getFeed(db, viewer);
  const lines: string[] = [];
  for (const k of feed.asksForYou.slice(0, 3)) lines.push(`- ${k.team.name} asked your team: ${k.text}`);
  for (const d of feed.decisions.slice(0, 3)) lines.push(`- ${d.team.name} decided: ${d.text}`);
  for (const a of feed.alerts.slice(0, 2)) {
    const why = a.state === "slipped"
      ? `was due ${fmt(a.due)}, and ${a.ownerUnit.name} is working out a new date${a.shown.reason ? ` (${a.shown.reason.replace(/\.$/, "")})` : ""}`
      : `is waiting on ${a.blockedBy ? `${a.blockedBy.ownerUnit.name}'s "${a.blockedBy.shown.title}"` : "another team"}, so its date may move`;
    lines.push(`- **${a.shown.title}** (${a.ownerUnit.name}) ${why}.`);
  }
  if (lines.length === 0) return { text: "Nothing from the teams you work with affects you this week.", refs: [{ label: "What's changing", href: "/feed" }], actions: [] };
  return { text: `Here's what changed for you this week:\n${lines.join("\n")}`, refs: [{ label: "What's changing", href: "/feed" }], actions: [] };
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
