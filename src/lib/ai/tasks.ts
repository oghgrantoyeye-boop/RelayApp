// Every AI job in Relay. Each one asks the model first and falls back to the offline writer.
// Inputs are only what the reader (or author) may see. Nothing here decides or does a team's work.
import { getLLM } from "./llm";
import * as off from "./offline";

export const ITEM_KIND_ENUM = ["progress", "decision", "risk", "ask"] as const;
type Kind = (typeof ITEM_KIND_ENUM)[number];

export interface TeamInfo {
  id: string;
  name: string;
  /** Ownership titles and keywords, used to suggest affected teams. */
  owns: string[];
}

export interface SplitItem {
  kind: Kind;
  text: string;
  summary: string;
  headline: string;
  affected_unit_ids: string[];
}

export interface SuggestedCommitment {
  title: string;
  due_date: string;
  waiting_unit_id: string | null;
  revises_commitment_id: string | null;
  item_index: number;
}

export interface SplitInput {
  text: string;
  unitId: string;
  unitName: string;
  today: string;
  teams: TeamInfo[];
  openCommitments: { id: string; title: string; due_date: string; waiting_unit_id: string | null }[];
}

const SPLIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "commitments"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "text", "summary", "headline", "affected_unit_ids"],
        properties: {
          kind: { type: "string", enum: [...ITEM_KIND_ENUM] },
          text: { type: "string" },
          summary: { type: "string" },
          headline: { type: "string" },
          affected_unit_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
    commitments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "due_date", "waiting_unit_id", "revises_commitment_id", "item_index"],
        properties: {
          title: { type: "string" },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          waiting_unit_id: { type: "string", description: "Team id, or empty string" },
          revises_commitment_id: { type: "string", description: "Existing commitment id, or empty string" },
          item_index: { type: "integer" },
        },
      },
    },
  },
};

export async function splitUpdate(input: SplitInput): Promise<{ items: SplitItem[]; commitments: SuggestedCommitment[]; by: string }> {
  const llm = getLLM();
  const others = input.teams.filter((t) => t.id !== input.unitId);
  const out = await llm.json<{ items: SplitItem[]; commitments: (Omit<SuggestedCommitment, "waiting_unit_id" | "revises_commitment_id"> & { waiting_unit_id: string; revises_commitment_id: string })[] }>("split_update", {
    system:
      "You turn a team's written update or meeting notes into update items for Beacon, a tool that routes information between teams. " +
      "Only use what the text says. Never invent facts, dates or owners. Each item is one piece of news: progress, decision, risk or ask. " +
      "Write `text` as a clear sentence or two in the team's voice. `summary` is one sentence for teams that follow this one. " +
      "`headline` is under 10 words for the rest of the company and must not contain details the summary leaves out. " +
      "Tag `affected_unit_ids` only with ids from the team list whose work the item touches. " +
      "List a commitment only for an explicit promise with a date. If it changes one of the open commitments, set revises_commitment_id.",
    prompt:
      `Today is ${input.today}. Author's team: ${input.unitName} (${input.unitId}).\n\n` +
      `Other teams (id: name, owns):\n${others.map((t) => `- ${t.id}: ${t.name}; owns ${t.owns.slice(0, 8).join(", ")}`).join("\n")}\n\n` +
      `Open commitments of this team:\n${input.openCommitments.map((c) => `- ${c.id}: "${c.title}", due ${c.due_date}, waiting team ${c.waiting_unit_id ?? "none"}`).join("\n") || "none"}\n\n` +
      `Update text:\n"""\n${input.text}\n"""`,
    schema: SPLIT_SCHEMA,
  });
  const ids = new Set(others.map((t) => t.id));
  const cids = new Set(input.openCommitments.map((c) => c.id));
  if (out && Array.isArray(out.items) && out.items.length > 0) {
    const items = out.items
      .filter((i) => ITEM_KIND_ENUM.includes(i.kind) && i.text)
      .map((i) => ({ ...i, affected_unit_ids: (i.affected_unit_ids ?? []).filter((id) => ids.has(id)) }));
    const commitments = (out.commitments ?? [])
      .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.due_date) && c.title)
      .map((c) => ({
        ...c,
        waiting_unit_id: ids.has(c.waiting_unit_id) ? c.waiting_unit_id : null,
        revises_commitment_id: cids.has(c.revises_commitment_id) ? c.revises_commitment_id : null,
        item_index: Math.min(Math.max(0, c.item_index | 0), items.length - 1),
      }));
    if (items.length > 0) return { items, commitments, by: llm.name };
  }
  return { ...offlineSplit(input), by: "Offline writer" };
}

/** Teams an item touches: it names them, or mentions something they own. */
export function suggestAffected(text: string, unitId: string, teams: TeamInfo[]): string[] {
  const words = off.tokens(text);
  return teams
    .filter((t) => t.id !== unitId)
    .filter(
      (t) =>
        off.overlap(words, off.tokens(t.name)) >= Math.min(2, off.tokens(t.name).length) ||
        t.owns.some((o) => {
          const ow = off.tokens(o);
          return ow.length > 0 && off.overlap(words, ow) >= Math.min(2, ow.length);
        }),
    )
    .map((t) => t.id);
}

export function offlineSplit(input: SplitInput): { items: SplitItem[]; commitments: SuggestedCommitment[] } {
  const items: SplitItem[] = [];
  const commitments: SuggestedCommitment[] = [];
  for (const s of off.sentences(input.text)) {
    const affected = suggestAffected(s, input.unitId, input.teams);
    const promise = off.findPromise(s, input.today);
    let kind = off.classify(s);
    let revises: (typeof input.openCommitments)[number] | undefined;
    if (promise) {
      revises = input.openCommitments
        .map((c) => ({ c, score: off.overlap(off.tokens(promise.title), off.tokens(c.title)) }))
        .filter((x) => x.score >= 2)
        .sort((a, b) => b.score - a.score)[0]?.c;
      if (kind === "progress") kind = "decision";
      const waiting = revises?.waiting_unit_id ?? affected[0] ?? null;
      if (waiting && !affected.includes(waiting)) affected.push(waiting);
      commitments.push({
        title: revises ? revises.title : promise.title,
        due_date: promise.due,
        waiting_unit_id: waiting,
        revises_commitment_id: revises?.id ?? null,
        item_index: items.length,
      });
    }
    const { summary, headline } = off.levelTexts(s);
    items.push({ kind, text: s, summary, headline, affected_unit_ids: affected });
  }
  return { items, commitments };
}

export interface AnswerInput {
  question: string;
  /** The asker already answered a follow-up, so don't ask another. */
  noClarify?: boolean;
  teamName: string;
  today: string;
  sources: off.Doc[];
}

export interface Clarify {
  question: string;
  /** Two or three short replies the asker can pick. They can also type their own. */
  options: string[];
}

/** One statement in an answer. refs empty means Beacon inferred it: no source says it directly. */
export interface AnswerClaim {
  text: string;
  refs: string[];
}

export interface AnswerOutput {
  answered: boolean;
  /** The claims joined into prose, for places that show one line. */
  answer: string;
  claims: AnswerClaim[];
  /** What the agent looked for and couldn't find, in plain words. */
  gaps: string[];
  /** One follow-up question, when the right answer or the right person depends on something unsaid. */
  clarify?: Clarify;
  source_refs: string[];
  /** Closest published context when the agent couldn't fully answer. */
  partial?: off.Doc;
  by: string;
}

const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answered", "claims", "gaps"],
  properties: {
    answered: { type: "boolean" },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "refs"],
        properties: { text: { type: "string" }, refs: { type: "array", items: { type: "string" } } },
      },
    },
    gaps: { type: "array", items: { type: "string" } },
    clarify: {
      type: "object",
      additionalProperties: false,
      required: ["question", "options"],
      properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } } },
    },
  },
};

const MAX_CLAIMS = 5;

export async function answerFromPublished(input: AnswerInput): Promise<AnswerOutput> {
  const ranked = off.rank(input.question, input.sources).slice(0, 12);
  const llm = getLLM();
  if (ranked.length > 0) {
    const out = await llm.json<{ answered: boolean; claims: AnswerClaim[]; gaps: string[]; clarify?: Clarify }>("answer_question", {
      system:
        `You are the ${input.teamName} team's agent in Beacon. You answer colleagues from other teams using ONLY the sources given, ` +
        "which are already limited to what this person may see. Answer as a short list of claims, each one sentence. " +
        "Every claim cites the refs it rests on. You may add at most one claim with no refs when it follows plainly from the cited claims; " +
        "it will be shown as your inference. Never add facts, never promise anything for the team. " +
        "In gaps, say in a few words each thing the question asks that the sources don't answer. " +
        "If the sources don't answer the question at all (for example it asks for a date and none is given), set answered to false. " +
        (input.noClarify
          ? "Leave clarify.question empty: the asker already answered a follow-up."
          : "If the right answer, or the right person to ask, depends on something the question doesn't say, put ONE short follow-up in clarify.question " +
            "with two or three short suggested replies in clarify.options. Otherwise leave clarify.question empty."),
      prompt:
        `Today is ${input.today}.\nQuestion: ${input.question}\n\nSources:\n` +
        ranked.map((r) => `[${r.doc.ref}] ${r.doc.text}`).join("\n"),
      schema: ANSWER_SCHEMA,
      maxTokens: 1500,
    });
    if (out && typeof out.answered === "boolean" && Array.isArray(out.claims)) {
      const known = new Set(ranked.map((x) => x.doc.ref));
      let inferred = 0;
      const claims = out.claims
        .map((c) => ({ text: String(c.text ?? "").trim(), refs: (c.refs ?? []).filter((r) => known.has(r)) }))
        .filter((c) => c.text && (c.refs.length > 0 || inferred++ === 0))
        .slice(0, MAX_CLAIMS);
      const refs = [...new Set(claims.flatMap((c) => c.refs))];
      const gaps = (out.gaps ?? []).map((g) => String(g).trim()).filter(Boolean).slice(0, 3);
      const clarify = cleanClarify(out.clarify, input.noClarify);
      // An answer needs at least one sourced claim; inference alone is not an answer.
      if (!out.answered || refs.length === 0)
        return { answered: false, answer: "", claims: [], gaps, source_refs: [], partial: ranked[0]?.doc, clarify, by: llm.name };
      return { answered: true, answer: claims.map((c) => c.text).join(" "), claims, gaps, source_refs: refs, clarify, by: llm.name };
    }
  }
  return { ...offlineAnswer(input, ranked), by: "Offline writer" };
}

function cleanClarify(c: Clarify | undefined, off: boolean | undefined): Clarify | undefined {
  if (off || !c) return undefined;
  const question = String(c.question ?? "").trim();
  const options = (c.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 3);
  return question && options.length >= 2 ? { question: question.slice(0, 200), options: options.map((o) => o.slice(0, 60)) } : undefined;
}

function offlineAnswer(input: AnswerInput, ranked: { doc: off.Doc; score: number }[]): Omit<AnswerOutput, "by"> {
  const none = (gaps: string[], partial?: off.Doc) => ({ answered: false, answer: "", claims: [], gaps, source_refs: [], partial });
  const qn = off.tokens(input.question).length;
  const threshold = Math.min(2, Math.max(1, qn - 1));
  const relevant = ranked.filter((r) => r.score >= threshold);
  const top = relevant[0];
  if (!top) return none([`${input.teamName} hasn't shared anything that answers this.`], ranked[0]?.doc);
  if (off.asksForDate(input.question)) {
    // A "when" question needs a source that gives an upcoming date.
    const dated = relevant.find((r) => {
      const d = off.findDate(r.doc.text, input.today);
      return !!d && d >= input.today;
    });
    if (!dated) return none(["A date. Nothing shared gives an upcoming one."], top.doc);
    return { answered: true, answer: dated.doc.text, claims: [{ text: dated.doc.text, refs: [dated.doc.ref] }], gaps: [], source_refs: [dated.doc.ref] };
  }
  const used = [top, ...relevant.filter((r) => r !== top && r.score === top.score && !r.doc.ref.startsWith("ownership:"))].slice(0, 2);
  // Word matching can't tell what an answer is missing, so the offline writer only names gaps when
  // it can't answer at all. The model names them for partial answers.
  return {
    answered: true,
    answer: used.map((u) => u.doc.text).join(" "),
    claims: used.map((u) => ({ text: u.doc.text, refs: [u.doc.ref] })),
    gaps: [],
    source_refs: used.map((u) => u.doc.ref),
  };
}

export interface OwnershipInfo {
  id: string;
  title: string;
  description: string;
  keywords: string[];
}

/** Which ownership item a question is about, so it reaches the right person. */
export function routeQuestion(question: string, ownership: OwnershipInfo[]): string | null {
  const q = off.tokens(question);
  let best: { id: string; score: number } | null = null;
  for (const o of ownership) {
    const score = 2 * off.overlap(q, o.keywords.flatMap(off.tokens)) + off.overlap(q, off.tokens(`${o.title} ${o.description}`));
    if (score > 0 && (!best || score > best.score)) best = { id: o.id, score };
  }
  return best?.id ?? null;
}

const LEVELS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "headline"],
  properties: { summary: { type: "string" }, headline: { type: "string" } },
};

/** Summary and Headline versions of one item, written only from its own text. */
export async function writeLevels(text: string, context: string, opts: { answer?: string } = {}): Promise<{ summary: string; headline: string }> {
  const out = await getLLM().json<{ summary: string; headline: string }>("write_levels", {
    system:
      "Write two shorter versions of a team's update item for Beacon. `summary`: one sentence for teams that follow this team. " +
      "`headline`: under 10 words for the rest of the company. Use only the text given; drop names of customers, people and numbers the headline doesn't need.",
    prompt: `${context}\n\nItem:\n${text}`,
    schema: LEVELS_SCHEMA,
    maxTokens: 800,
  });
  if (out?.summary && out?.headline) return out;
  return opts.answer ? off.answerLevels(opts.answer) : off.levelTexts(text);
}

const PARA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["paragraph"],
  properties: { paragraph: { type: "string" } },
};

/** The leadership digest's one paragraph for a team, from the items leadership may see. */
export async function teamHeadline(teamName: string, items: { kind: string; text: string }[]): Promise<{ text: string; by: string }> {
  if (items.length === 0) return { text: `${teamName} published nothing new this week.`, by: "Offline writer" };
  const llm = getLLM();
  const out = await llm.json<{ paragraph: string }>("team_headline", {
    system:
      "Write one paragraph (2-3 sentences, under 70 words) for a weekly leadership digest about one team. " +
      "Lead with decisions and risks, then progress. Use only the items given. No preamble.",
    prompt: `Team: ${teamName}\nItems:\n${items.map((i) => `- (${i.kind}) ${i.text}`).join("\n")}`,
    schema: PARA_SCHEMA,
    maxTokens: 800,
  });
  if (out?.paragraph) return { text: out.paragraph, by: llm.name };
  const order = ["decision", "risk", "ask", "progress", "answer"];
  const picked = [...items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, 3);
  return { text: picked.map((i) => off.firstSentence(i.text).replace(/([^.!?])$/, "$1.")).join(" "), by: "Offline writer" };
}

export interface SessionInput {
  repo: string;
  branch: string;
  prompts: string[];
  notes: string[];
  commits: string[];
  diffstat: string;
}

const SESSION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "text"],
        properties: { kind: { type: "string", enum: [...ITEM_KIND_ENUM] }, text: { type: "string" } },
      },
    },
  },
};

/** Draft update items from a coding-agent session. The author reviews them before anything is shared. */
export async function draftFromSession(s: SessionInput): Promise<{ items: { kind: Kind; text: string }[]; by: string }> {
  const llm = getLLM();
  const out = await llm.json<{ items: { kind: Kind; text: string }[] }>("draft_session", {
    system:
      "Write 1-3 short update items about what a person worked on in a coding session, for their teammates and dependent teams. " +
      "Describe outcomes in plain language (what changed, what's blocked, what they need). Never include code, file contents, secrets, " +
      "tokens, URLs with credentials or customer data.",
    prompt:
      `Repo ${s.repo}, branch ${s.branch}.\nWhat they asked their coding agent:\n${s.prompts.map((p) => `- ${p}`).join("\n")}\n` +
      `Agent's closing notes:\n${s.notes.map((n) => `- ${n}`).join("\n")}\nCommits:\n${s.commits.join("\n")}\nDiff stat: ${s.diffstat}`,
    schema: SESSION_SCHEMA,
    maxTokens: 1500,
  });
  if (out?.items?.length) return { items: out.items.filter((i) => ITEM_KIND_ENUM.includes(i.kind)).slice(0, 3), by: llm.name };
  const subjects = s.commits.map((c) => c.replace(/^[0-9a-f]{7,}\s+/, "")).filter(Boolean);
  const what = subjects.length
    ? subjects.slice(0, 2).map((c, i) => (i === 0 ? c : c.charAt(0).toLowerCase() + c.slice(1))).join(", and ")
    : off.capitalize(off.shorten(s.prompts[0] ?? "Work in progress", 120));
  const repo = s.repo.split("/").pop();
  const items: { kind: Kind; text: string }[] = [{ kind: "progress", text: `${what.replace(/[.]$/, "")} (${repo}, ${s.branch}).` }];
  const blocked = [...s.notes, ...s.prompts].find((t) => off.classify(t) === "risk");
  if (blocked) items.push({ kind: "risk", text: off.shorten(blocked, 200) });
  return { items, by: "Offline writer" };
}

const CONTEXT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "title", "body"],
        properties: {
          kind: { type: "string", enum: ["about", "responsibility", "capability", "how_to_work", "knows", "system"] },
          title: { type: "string" },
          body: { type: "string" },
        },
      },
    },
  },
};

export interface ExtractInput {
  teamName: string;
  /** answer, agent_chat, update, pr, coding_session, meeting, source_doc, slack */
  kind: string;
  text: string;
  /** For an answer: the question it answers. */
  question?: string;
  /** For a pull request: the repository. */
  repo?: string;
  /** Titles Beacon already knows for this team, so the model reuses them instead of rephrasing. */
  known: string[];
}

/**
 * Lasting facts about a team in its own words: what it owns, runs, can help with, knows and how to
 * ask it. Never time-bound status, never anything about people's performance, at most five.
 */
export async function extractContext(input: ExtractInput): Promise<{ claims: off.ContextClaim[]; by: string }> {
  const llm = getLLM();
  const out = await llm.json<{ claims: off.ContextClaim[] }>("extract_context", {
    system:
      `You maintain Beacon's picture of the ${input.teamName} team so other teams can understand it. From one piece of the team's own ` +
      "activity, extract lasting facts other teams would want to know: what the team owns (responsibility), systems it runs (system), " +
      "what it can help with (capability), what it knows how to do (knows), how to work with it (how_to_work), or what it is (about). " +
      "Only what the text states or a team member clearly says. Skip time-bound status, dates, opinions and anything about individuals' " +
      "performance. Reuse a known title when the fact is the same. Titles are short noun phrases; bodies are one plain sentence. " +
      "Return an empty list when there is nothing lasting. At most five.",
    prompt:
      `Source: ${input.kind}${input.repo ? ` in ${input.repo}` : ""}\n` +
      (input.question ? `Question it answers: ${input.question}\n` : "") +
      `Text:\n${input.text}\n\nKnown titles:\n${input.known.slice(0, 40).map((t) => `- ${t}`).join("\n") || "(none yet)"}`,
    schema: CONTEXT_SCHEMA,
    maxTokens: 1500,
  });
  if (out && Array.isArray(out.claims)) {
    const claims = out.claims.filter((c) => c && typeof c.title === "string" && c.title.trim()).slice(0, 5);
    return { claims, by: llm.name };
  }
  return { claims: off.extractContext(input), by: "Offline writer" };
}
