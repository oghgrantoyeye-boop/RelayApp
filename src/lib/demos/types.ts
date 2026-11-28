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
  /** What to do and what to look at, in about 30 words. */
  text: string;
  /** One line on why this matters to the customer. */
  why?: string;
  /** Someone to open the same page as, to show what they can't see. */
  compare?: string;
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
  /** Not offered on the demo picker until its story is rewritten around team context (T-51). */
  hidden?: boolean;
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
  /** One sentence about the problem, for the picker. */
  summary: string;
  /** The guide's opening: the one problem, and the two or three people the viewer plays. */
  intro: {
    problem: string;
    cast: { as: string; note: string }[];
  };
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
  /** Answers people already gave to requests, so Beacon has learned from them (T-14). */
  answers?: { request: string; by: string; text: string; at: string }[];
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
    /** A suggested reply in the team queue, by the question it answers, so the guide can be clicked through. */
    answerExamples?: Record<string, string>;
    searchHint: string;
    researchHint: string;
    /** Coding-agent sessions for software teams; empty for orgs without them. */
    sampleSessions: Record<string, SampleSession>;
  };
  /** An agent teammate the upstream owner creates in the guide, prefilled on the New teammate page. */
  agentTemplate: { team: string; name: string; purpose: string; /** The first job the guide gives it, offered as a one-click suggestion. */ firstJob: string; actions: ("answer" | "research" | "draft_update" | "triage" | "meetings" | "documents" | "code" | "post")[] };
  /** About five steps, each showing one clear win. */
  guide: GuideStep[];
  /** Optional extras after the main steps. */
  explore: GuideStep[];
  /** What the story must show, checked by tests/demos.test.ts for every demo. */
  checks: {
    search: { q: string; team: string; owns: string };
    feed: { as: string; decision: string; atRisk: string };
    slipped: { as: string; team: string; commitment: string; reason: string };
    /** The upstream lead's example notes (ui.writeExamples[team]) revise this commitment. */
    revise: { as: string; team: string; commitment: string; due: string; notify: string[] };
    digest: { allowed: string; denied: string; marking: string; slipped: string[] };
    route: { as: string; team: string; question: string; owner: string; cluster: string; askers: number };
    answer: { as: string; team: string; question: string; contains: string; source: string };
    /** Someone outside the marking asks about the confidential subject; this word must not leak. */
    leak: { as: string; team: string; question: string; secret: string };
    /**
     * The team-context story (M3 to M5): a question no one owns gets what the team has shared plus
     * the team queue; a teammate answers; the asker closes it; the next person is answered from
     * what Beacon learned.
     */
    story?: { as: string; team: string; question: string; answerer: string; next: string; nextQuestion: string; contains: string };
  };
}
