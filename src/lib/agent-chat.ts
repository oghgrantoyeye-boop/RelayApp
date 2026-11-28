// One turn of a real conversation with an agent. The model sees the conversation so far and a
// short description of the workspace, and calls Beacon's abilities as tools: who owns something,
// asking a team (sourced answer, or routed to the owner or the team queue), what changed, what
// the viewer's teams owe, and links to show. Workspace facts only ever come from those tools,
// read at the viewer's level, exactly as the rest of Beacon reads them.
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import type { Db, Row } from "./db";
import type { Viewer } from "./data";
import type { AgentRow } from "./agents";
import { search } from "./directory";
import { askTeam } from "./agent";
import { chatModel } from "./ai/chat";
import { overBudget, record } from "./ai/llm";
import { setAiScope } from "./ai/scope";
import { attention, owed, replyForQuestion, type ChatAction, type ChatMsg, type ChatRef, type Reply } from "./assistant";

/** Links the model can put under its reply, only when they help. */
const LINKS = {
  connect_tools: { label: "Connect GitHub or Claude Code", href: "/connect" },
  write_update: { label: "Write an update", href: "/write" },
  invite_people: { label: "Invite people", href: "/workspace/people" },
  my_team_page: { label: "Your team page", href: "" },
  browse_teams: { label: "Browse teams", href: "/directory" },
  my_questions: { label: "My questions", href: "/questions" },
  whats_changing: { label: "What's changing", href: "/feed" },
} as const;
type LinkId = keyof typeof LINKS;

const HISTORY = 20;

async function history(db: Db, viewer: Viewer, target: string): Promise<ModelMessage[]> {
  const rows = await db.query(
    `select role, text from chat_message where user_id = $1 and target = $2 order by created_at desc, id desc limit $3`,
    [viewer.user.id, target, HISTORY],
  );
  const out: ModelMessage[] = [];
  for (const r of rows.reverse()) {
    const role = r.role === "user" ? "user" : "assistant";
    const text = String(r.text ?? "").trim() || "(no text)";
    // Keep strict user/assistant turns: merge repeats so the history is always valid.
    const prev = out.at(-1);
    if (prev && prev.role === role) prev.content = `${prev.content}\n\n${text}`;
    else out.push({ role, content: text } as ModelMessage);
  }
  while (out.length > 0 && out[0].role !== "user") out.shift();
  return out;
}

async function askableTeams(db: Db, viewer: Viewer): Promise<Row[]> {
  return db.query(`select id, name, slug, description from unit where org_id = $1 and how_to_ask <> '{}'::jsonb order by name`, [viewer.orgId]);
}

function system(viewer: Viewer, agent: AgentRow | null, teams: Row[], orgName: string): string {
  const first = String(viewer.user.name).split(" ")[0];
  const mine = teams.filter((t) => viewer.reader.unitIds.includes(t.id));
  const others = teams.filter((t) => !viewer.reader.unitIds.includes(t.id));
  const list = (ts: Row[]) => ts.map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`).join("\n") || "- (none)";
  const who = agent
    ? `You are ${agent.name}, the agent for the ${agent.team.name} team in Beacon. ${agent.purpose} You're talking with ${viewer.user.name}${viewer.reader.unitIds.includes(agent.team.id) ? ", who is on this team" : ", who is on another team"}.`
    : `You are ${first}'s Beacon agent, a personal assistant inside Beacon. Beacon keeps track of what each team or project in the workspace is doing, answers questions from what they've shared, with sources, and routes anything new to whoever owns it. You're talking with ${viewer.user.name}.`;
  return [
    who,
    `Workspace: ${orgName}. ${first}'s teams:\n${list(mine)}\nOther teams they can ask:\n${list(others)}`,
    others.length === 0 && !agent
      ? "The workspace is new: there are no other teams yet and Beacon hasn't learned much. If it helps, suggest connecting GitHub or Claude Code, writing a first update, or inviting people, and show those links."
      : "",
    "How to work:",
    "- Talk naturally, like a helpful coworker in a chat. Keep replies short: one to four sentences unless more is needed. Markdown is fine. Don't reintroduce yourself if you already have in this conversation.",
    "- Facts about the workspace, its teams, people or work come only from your tools. Never invent them. If the tools don't have it, say so plainly.",
    `- For a real question about a team's work, call ask_team. It answers from what that team has shared, at ${first}'s level of access, or sends the question to the owner or the team's queue. Say where it went. Don't call it for greetings, small talk or general knowledge.`,
    "- If you don't know which team covers something, call find_owner first. If two teams fit, ask which one.",
    "- General questions that aren't about the workspace: answer from your own knowledge, briefly.",
    "- Use show_links only when a link is the obvious next step. Most replies need none.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Run one turn: stream the reply through onDelta, then return what to save with it. */
export async function agentTurn(
  db: Db,
  viewer: Viewer,
  agent: AgentRow | null,
  target: string,
  onDelta: (text: string) => void,
): Promise<Reply | null> {
  const model = chatModel();
  if (!model) return null;
  // Model calls in this turn count against the viewer's workspace budget.
  setAiScope(db, viewer.orgId);
  if (await overBudget("chat")) return null;
  const teams = await askableTeams(db, viewer);
  const org = await db.one(`select name from org where id = $1`, [viewer.orgId]);
  const collected: { refs: ChatRef[]; actions: ChatAction[]; answer?: ChatMsg["answer"] } = { refs: [], actions: [] };
  const addRef = (r: ChatRef) => {
    if (!collected.refs.some((x) => x.href === r.href && x.label === r.label)) collected.refs.push(r);
  };
  const teamByName = (name: string) => {
    const n = name.trim().toLowerCase();
    return teams.find((t) => t.name.toLowerCase() === n || t.slug === n) ?? teams.find((t) => t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase()));
  };

  const tools = {
    find_owner: tool({
      description: "Find which team or person in the workspace owns or knows about a topic. Use before ask_team when the team isn't obvious.",
      inputSchema: z.object({ topic: z.string().describe("What to look for, in a few words") }),
      execute: async ({ topic }) => {
        const r = await search(db, topic, viewer.orgId);
        const found = r.teams.filter((x) => Object.keys(x.team.how_to_ask ?? {}).length > 0).slice(0, 3);
        for (const t of found) addRef({ label: t.team.name, href: `/teams/${t.team.slug}` });
        return {
          teams: found.map((t) => ({ name: t.team.name, why: t.why })),
          people: r.people.slice(0, 5).map((p) => ({ name: p.name, title: p.title, team: p.unit_name })),
        };
      },
    }),
    ask_team: tool({
      description:
        "Ask a team about its work. Returns what the team has shared that answers it, with sources, or tells you the question was sent to the owner or the team's queue. Only for real questions about a team's work.",
      inputSchema: z.object({
        team: z.string().describe("The team's name, exactly as listed"),
        question: z.string().describe("The question, in the asker's words, complete enough to stand alone"),
      }),
      execute: async ({ team, question }) => {
        const unit = agent ? teams.find((t) => t.id === agent.team.id) : teamByName(team);
        if (!unit) return { error: `No team called "${team}" here. Teams: ${teams.map((t) => t.name).join(", ") || "none"}.` };
        const { questionId } = await askTeam(db, viewer, unit.id, question, { noClarify: true });
        const r = await replyForQuestion(db, viewer, questionId, "");
        for (const ref of r.refs) addRef(ref);
        collected.actions.push(...r.actions);
        if (r.answer && (r.answer.claims.length > 0 || r.answer.gaps.length > 0)) collected.answer = { ...r.answer, clarify: undefined };
        const q = await db.one(`select outcome, answer_text from question where id = $1`, [questionId]);
        return {
          team: unit.name,
          outcome: q?.outcome === "answered" ? "answered from what the team shared" : "sent on: no shared answer yet",
          details: r.text,
          claims: (r.answer?.claims ?? []).map((c) => ({ text: c.text, basis: c.basis, source: c.source?.label })),
          gaps: r.answer?.gaps ?? [],
          note: "The sources show under your reply. Summarize briefly; don't repeat every claim.",
        };
      },
    }),
    whats_changed: tool({
      description: `What changed this week that affects ${viewer.user.name}: decisions, asks and slipping dates from teams they work with.`,
      inputSchema: z.object({}),
      execute: async () => {
        const r = await attention(db, viewer);
        for (const ref of r.refs) addRef(ref);
        return { summary: r.text };
      },
    }),
    my_commitments: tool({
      description: "What the viewer's teams have committed to deliver, with due dates.",
      inputSchema: z.object({}),
      execute: async () => {
        const r = await owed(db, viewer);
        for (const ref of r.refs) addRef(ref);
        return { summary: r.text };
      },
    }),
    show_links: tool({
      description: "Show link buttons under your reply. Only when a link is the obvious next step.",
      inputSchema: z.object({ links: z.array(z.enum(Object.keys(LINKS) as [LinkId, ...LinkId[]])).max(3) }),
      execute: async ({ links }) => {
        for (const id of links) {
          const l = LINKS[id];
          if (id === "my_team_page") {
            if (viewer.team) addRef({ label: l.label, href: `/teams/${viewer.team.slug}` });
          } else addRef({ label: l.label, href: l.href });
        }
        return { shown: links };
      },
    }),
  };

  let text = "";
  let failed: string | null = null;
  const result = streamText({
    model,
    system: system(viewer, agent, teams, String(org?.name ?? "this workspace")),
    messages: await history(db, viewer, target),
    tools,
    stopWhen: stepCountIs(5),
    maxOutputTokens: 1200,
    onError: ({ error }) => {
      failed = error instanceof Error ? error.message : String(error);
    },
  });
  try {
    let fresh = false;
    for await (const part of result.fullStream) {
      // Text after a tool call starts a new paragraph.
      if (part.type === "start-step") fresh = true;
      if (part.type !== "text-delta" || !part.text) continue;
      const delta = fresh && text.trim() ? `\n\n${part.text.replace(/^\s+/, "")}` : part.text;
      fresh = false;
      text += delta;
      onDelta(delta);
    }
    const usage = await result.totalUsage;
    await record("chat", usage.inputTokens ?? 0, usage.outputTokens ?? 0);
  } catch (err) {
    failed = (err as Error).message;
  }
  if (failed && !text.trim()) {
    console.warn(`[beacon] chat model failed: ${failed}`);
    return null;
  }
  return { text: text.trim(), refs: collected.refs, actions: collected.actions, answer: collected.answer };
}
