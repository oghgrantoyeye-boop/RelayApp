// A demo pack is one fictional organization and its Dec 6 story: teams, people, what they own,
// eight weeks of updates, the story items, requests, commitments, tools, meetings and the script.
// seed.ts turns a pack into ordinary rows, so every demo runs through the same permission checks.

export type ItemKind = "progress" | "decision" | "risk" | "ask" | "answer";

export interface Team {
  id: string;
  name: string;
  parent: string | null;
  color: string;
  description: string;
  /** A group of teams (an org-chart node), not a team that posts updates. */
  group?: boolean;
  /** How long the team usually takes to answer a request. Default "2 business days". */
  turnaround?: string;
}

/** [user id, name, title, team, role] */
export type Person = [string, string, string, string, "lead" | "member"];
/** [id, team, title, description, owner user, keywords] */
export type Ownership = [string, string, string, string, string, string[]];
/** [kind, text, affected teams] */
export type Item = [ItemKind, string, string[]];
/** [team, week index 0-7, kind, full, summary, headline, affected, marking, key] */
export type StoryItem = [string, number, ItemKind, string, string, string, string[], string | null, string];
/** [id, from, to, requester, title, details, created, needed_by, status, ownership, assignee, cluster, via] */
export type Req = [string, string, string, string, string, string, string, string | null, string, string | null, string, string | null, "form" | "agent"];
/** [id, owner team, owner, waiting team, title, due, status, source kind, source id or story key, blocked by, slip reason, done] */
export type Com = [string, string, string, string | null, string, string, string, string, string | null, string | null, string | null, string | null];
/** [id, asker, team, text, outcome, answer, source refs, request, date] */
export type Qn = [string, string, string, string, "answered" | "routed", string, string[], string | null, string];
export type Conn = [id: string, unit: string, kind: string, name: string, by: string];
export type SourceDoc = [connector: string, kind: "message" | "ticket" | "doc" | "pr", ref: string | null, title: string, body: string, status: string | null, author: string, at: string, marking?: string];
export interface MeetingSummary {
  summary: string;
  decisions: string[];
  risks: string[];
  action_items: { owner: string; text: string; due: string }[];
  by: string;
}
export type Mtg = [id: string, unit: string, connector: string, title: string, at: string, minutes: number, attendees: string[], transcript: string, status: string, marking: string | null, summary: MeetingSummary | null];

export interface ConfidentialRequest {
  id: string;
  from: string;
  to: string;
  requester: string;
  title: string;
  details: string;
  summaryTitle: string;
  summaryDetails: string;
  headline: string;
  neededBy: string;
  ownership: string;
  assignee: string;
  marking: string;
  cluster: string;
  created: string;
}

export interface InterfaceOverride {
  from: string;
  to: string;
  level?: "full" | "summary" | "status" | "headline";
  cadence?: "immediate" | "weekly";
  allKinds?: boolean;
  /** Tool content kinds the interface also shares, such as "source:ticket". */
  sources?: string[];
}

export interface GuideStep {
  title: string;
  /** Who to view as for this step (a user id). */
  as: string;
  /** Where to go. */
  href: string;
  text: string;
}

export interface SampleSession {
  repo: string;
  branch: string;
  prompts: string[];
  notes: string[];
  commits: string[];
  diffstat: string;
}

export interface DemoPack {
  id: string;
  /** Who this demo is for, shown on the picker: "Mid-size software company". */
  audience: string;
  org: {
    name: string;
    /** Used in sentences: "Everyone else at Harborview sees Headlines." */
    short: string;
    headcount: number;
    /** For fictional email addresses and repositories. */
    domain: string;
    /** One sentence for agent prompts: "a fictional 300-person company that sells a payments API". */
    about: string;
  };
  /** Two or three sentences about the story, for the picker. */
  summary: string;
  defaultPersona: string;
  teams: Team[];
  people: Person[];
  /** Leaders of group teams who also sit on Leadership. */
  alsoOnLeadership: string[];
  owns: Ownership[];
  follows: Record<string, string[]>;
  interfaceOverrides: InterfaceOverride[];
  markings: { id: string; label: string; allowed: string[]; othersLevel: string }[];
  items: Record<string, Item[]>;
  story: StoryItem[];
  requests: Req[];
  confidentialRequests: ConfidentialRequest[];
  commitments: Com[];
  questions: Qn[];
  connectors: Conn[];
  docs: SourceDoc[];
  meetings: Mtg[];
  /** Dollars each agent has spent this month, by team. Others spent 12 of 150. */
  agentSpend: Record<string, number>;
  /** One finished agent task, so the workspace shows how a run looks. */
  task: {
    id: string;
    unit: string;
    requestedBy: string;
    title: string;
    instructions: string;
    steps: { at: string; kind: string; text: string }[];
    result: string;
    sources: { title: string }[];
    at: string;
    doneAt: string;
  };
  ui: {
    /** Example notes for Write update, by team. */
    writeExamples: Record<string, string>;
    /** Example question for a team's agent, by team. */
    askExamples: Record<string, string>;
    searchHint: string;
    researchHint: string;
    /** Coding-agent sessions for software teams; empty for orgs without them. */
    sampleSessions: Record<string, SampleSession>;
  };
  guide: GuideStep[];
}
