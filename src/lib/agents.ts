// Agents as teammates. Every team has a built-in agent (its front door), and a team can add more,
// each with one job. An agent belongs to one team, runs in its own sandbox, reads only what its
// team may read (and, when working for someone, only what that person may read), and needs a
// person's approval for anything that leaves the team.
import type { Db, Row } from "./db";
import { now } from "./clock";
import { audit, newId, ORG_ID, type Viewer } from "./data";
import { PermissionError } from "./permissions";
import { workersEnabled, WORKERS_OFF_MESSAGE } from "./flags";

/** What an agent can do. Q&A abilities only read; worker abilities run in the agent's sandbox. */
export const AGENT_ACTIONS = [
  { id: "answer", tier: "qa", label: "Answer questions", detail: "From what the team has published, at each asker's level. Routes the rest to the owner." },
  { id: "triage", tier: "qa", label: "Sort incoming requests", detail: "Suggests an owner and a due date for each new request." },
  { id: "draft_update", tier: "worker", label: "Draft the team's weekly update", detail: "Reads the tools it's allowed to and drafts items. A person reviews and publishes them." },
  { id: "meetings", tier: "worker", label: "Summarize meetings", detail: "Writes decisions down and drafts commitments from action items." },
  { id: "research", tier: "worker", label: "Research the web and the team's tools", detail: "Market, competitor or policy research, written up as a brief with sources." },
  { id: "documents", tier: "worker", label: "Review and draft documents", detail: "Reads a draft, contract or report, flags risks and drafts changes for a person to approve." },
  { id: "code", tier: "worker", label: "Check out and change code", detail: "Works on a copy of the team's repository in a sandbox, runs the tests and opens a pull request for review." },
  { id: "post", tier: "worker", label: "Post in the team's tools", detail: "Slack messages and ticket comments. Always needs a person's approval." },
] as const;
export type AgentActionId = (typeof AGENT_ACTIONS)[number]["id"];

/** Q&A teammates only answer and route. Workers do jobs in a sandbox. */
export function tierOf(actions: readonly string[]): "qa" | "worker" {
  return actions.some((a) => AGENT_ACTIONS.find((x) => x.id === a)?.tier === "worker") ? "worker" : "qa";
}
export const TIER_LABEL = { qa: "Q&A", worker: "Worker" } as const;

export const APPROVAL = {
  outside_team: "A person approves anything that leaves the team",
  always: "A person approves everything it produces",
} as const;

export const SCHEDULE = { on_request: "When someone asks", daily: "Every weekday morning", weekly: "Every Friday" } as const;

export interface AgentTemplate {
  id: string;
  name: string;
  purpose: string;
  actions: AgentActionId[];
  schedule: keyof typeof SCHEDULE;
  /** Who made it: Beacon ships these; a demo adds one that fits the organization. */
  by: "beacon" | "demo";
}

/** Ready-made teammates any team can add. The demo adds one that fits its organization. */
export const GALLERY: AgentTemplate[] = [
  { id: "qa", by: "beacon", name: "Front desk", purpose: "Answer other teams' questions from what we've published, and send anything new to the person who owns it.", actions: ["answer", "triage"], schedule: "on_request" },
  { id: "update", by: "beacon", name: "Weekly update writer", purpose: "Every Friday, read the team's tools and draft the weekly update for the lead to review.", actions: ["draft_update"], schedule: "weekly" },
  { id: "notes", by: "beacon", name: "Meeting notetaker", purpose: "Join the team's meetings, write the decisions down and draft commitments from action items.", actions: ["meetings"], schedule: "on_request" },
  { id: "market", by: "beacon", name: "Market researcher", purpose: "Research competitors, customers and markets on the web, and write a short brief with sources.", actions: ["research"], schedule: "on_request" },
  { id: "legal", by: "beacon", name: "Document reviewer", purpose: "Review contracts, policies and drafts: flag risky clauses, missing terms and claims that need support, and draft changes for a person to approve.", actions: ["documents", "research"], schedule: "on_request" },
  { id: "coder", by: "beacon", name: "Coding agent", purpose: "Check out the team's repository in a sandbox, fix small bugs and chores, run the tests and open a pull request for review.", actions: ["code", "draft_update"], schedule: "on_request" },
];

export function galleryFor(demo: { agentTemplate: { team: string; name: string; purpose: string; actions: string[] } }): AgentTemplate[] {
  const t = demo.agentTemplate;
  return [{ id: "demo", by: "demo", name: t.name, purpose: t.purpose, actions: t.actions as AgentActionId[], schedule: "on_request" }, ...GALLERY];
}

export interface AgentRow {
  id: string;
  name: string;
  builtIn: boolean;
  team: { id: string; name: string; slug: string; color: string };
  purpose: string;
  actions: string[];
  connectorIds: string[];
  approval: keyof typeof APPROVAL;
  schedule: keyof typeof SCHEDULE;
  spent: number;
  budget: number;
  createdBy: string | null;
  tier: "qa" | "worker";
}

// The built-in agent every team gets: its front door, which answers and routes, drafts and takes notes.
const BUILT_IN_ACTIONS: AgentActionId[] = ["answer", "triage", "draft_update", "meetings", "research"];

function toAgent(r: Row): AgentRow {
  const builtIn = r.id === `agent_${r.unit_id}`;
  return {
    id: r.id,
    name: r.name,
    builtIn,
    team: { id: r.unit_id, name: r.unit_name, slug: r.unit_slug, color: r.unit_color },
    purpose: r.purpose ?? "The team's front door: answers other teams from what it has published, routes the rest to the owner, and drafts updates and meeting notes for the team.",
    actions: r.actions ?? BUILT_IN_ACTIONS,
    connectorIds: r.connector_ids ?? [],
    approval: r.approval ?? "outside_team",
    schedule: r.schedule ?? "on_request",
    spent: Number(r.spent_usd ?? 0),
    budget: Number(r.monthly_budget_usd ?? 0),
    createdBy: r.created_by_name ?? null,
    // The built-in agent is the team's front desk: Q&A first, with light drafting for its own team.
    tier: builtIn ? "qa" : tierOf(r.actions ?? BUILT_IN_ACTIONS),
  };
}

const AGENT_SELECT = `
  select a.*, m.unit_id, u.name as unit_name, u.slug as unit_slug, u.color as unit_color,
         p.purpose, p.actions, p.connector_ids, p.approval, p.schedule, cb.name as created_by_name, p.created_at as profile_created
  from app_user a join member m on m.user_id = a.id join unit u on u.id = m.unit_id
  left join agent_profile p on p.agent_id = a.id left join app_user cb on cb.id = p.created_by
  where a.kind = 'agent'`;

/** Every agent in the organization. Names and jobs are public, like the directory. */
export async function listAgents(db: Db): Promise<AgentRow[]> {
  const rows = await db.query(`${AGENT_SELECT} order by u.name, (a.id = 'agent_' || m.unit_id) desc, p.created_at`);
  const agents = rows.map(toAgent);
  // With work-performing agents off, worker teammates a team made earlier are hidden, not deleted.
  return workersEnabled() ? agents : agents.filter((a) => a.tier === "qa");
}

export async function getAgent(db: Db, id: string): Promise<AgentRow | null> {
  const r = await db.one(`${AGENT_SELECT} and a.id = $1`, [id]);
  return r ? toAgent(r) : null;
}

/** Teams a person can add agents to: the non-group teams they belong to. */
export function teamsFor(viewer: Viewer): Row[] {
  return viewer.units.filter((u) => Object.keys(u.how_to_ask ?? {}).length > 0);
}

export interface NewAgent {
  unitId: string;
  name: string;
  purpose: string;
  connectorIds: string[];
  actions: string[];
  approval: string;
  schedule: string;
  budget: number;
}

export async function createAgent(db: Db, viewer: Viewer, input: NewAgent): Promise<string> {
  const unit = teamsFor(viewer).find((u) => u.id === input.unitId);
  if (!unit) throw new PermissionError("You can only add agents to a team you're on.");
  const name = input.name.trim().slice(0, 60);
  const purpose = input.purpose.trim().slice(0, 600);
  if (!name) throw new Error("Give the agent a name.");
  if (!purpose) throw new Error("Say what the agent's job is.");
  const actions = input.actions.filter((a) => AGENT_ACTIONS.some((x) => x.id === a));
  if (actions.length === 0) throw new Error("Pick at least one thing the agent can do.");
  if (!workersEnabled() && tierOf(actions) === "worker") throw new Error(WORKERS_OFF_MESSAGE);
  // It can only read tools its own team connected.
  const own = await db.query(`select id from connector where unit_id = $1`, [unit.id]);
  const connectorIds = input.connectorIds.filter((c) => own.some((o) => o.id === c));
  const approval = input.approval === "always" ? "always" : "outside_team";
  const schedule = input.schedule in SCHEDULE ? input.schedule : "on_request";
  const budget = Math.max(1, Math.min(500, Math.round(input.budget || 0)));
  const fullName = /agent$/i.test(name) ? name : `${name} agent`;
  const id = newId("ag");
  await db.query(`insert into app_user (id, org_id, kind, name, title, ask_cadence, monthly_budget_usd, spent_usd) values ($1, $2, 'agent', $3, $4, 'immediate', $5, 0)`, [
    id, ORG_ID, fullName, purpose.slice(0, 120), budget,
  ]);
  await db.query(`insert into member (id, unit_id, user_id, role) values ($1, $2, $3, 'agent')`, [`m_${id}_${unit.id}`, unit.id, id]);
  await db.query(
    `insert into agent_profile (agent_id, unit_id, purpose, connector_ids, actions, approval, schedule, created_by, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, unit.id, purpose, connectorIds, actions, approval, schedule, viewer.user.id, now()],
  );
  await audit(db, { actorId: viewer.user.id, action: "agent_create", targetKind: "agent", targetId: id, detail: { team: unit.id, actions, connectors: connectorIds.length, approval, budget } });
  return id;
}
