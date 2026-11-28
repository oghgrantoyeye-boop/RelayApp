// The offline writer: plain heuristics that do every AI task without a model. It keeps the demo
// working with no API key and gives tests deterministic output. Claude does these better.

const STOP = new Set(
  ("a an the and or but if then so of to in on at by for from with about as is are was were be been being it its this that these those " +
    "we our us you your they their them i me my he she his her do does did done can could will would should shall may might must " +
    "what when where which who whom why how there here any some all not no yes up out over into than too very just also still yet " +
    "get got has have had having let lets per via vs please thanks hi team week weekly update now new ll re ve don doesn isn won").split(" "),
);

export function tokens(text: string): string[] {
  return (text.toLowerCase().replace(/'s\b/g, "").match(/[a-z0-9]+/g) ?? [])
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function overlap(a: string[], b: string[]): number {
  const sb = new Set(b);
  return [...new Set(a)].filter((w) => sb.has(w)).length;
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((w) => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

export function sentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((s) => s.length >= 12 && /[a-z]/i.test(s) && !/^(hi|hello|hey|thanks|notes|attendees|agenda)\b/i.test(s))
    // Drop title lines such as "Platform sync, Dec 6": short and without closing punctuation.
    .filter((s) => /[.!?]$/.test(s) || s.split(/\s+/).length > 6);
}

export function classify(s: string): "progress" | "decision" | "risk" | "ask" {
  const t = s.toLowerCase();
  if (/\b(can you|could you|we need|need (?:a|an|the|from)|please|asking|ask:|requesting|would like)\b/.test(t)) return "ask";
  if (/^(can|could|would|will|is|are|does|do)\b.*\?$/.test(t.trim())) return "ask";
  if (/\b(fixed|fix is merged|merged|resolved|shipped|stable|is live|done|completed|on track)\b/.test(t) && !/\b(blocked|will miss|at risk)\b/.test(t)) return /\b(we'll|we will)\b/.test(t) ? "decision" : "progress";
  const negated = /\b(isn't|is not|not|no longer|aren't|wasn't) (blocked|at risk|delayed|behind)\b/.test(t);
  if (!negated && /\b(blocked|blocker|at risk|risk|delay|delayed|slip|slipp|miss|behind|depends on|waiting on|leak|outage|concern)\b/.test(t)) return "risk";
  if (/\b(decided|decision|we will|we'll|agreed|going with|chose|choose|plan to|planned|switch(?:ing)? to|default)\b/.test(t)) return "decision";
  return "progress";
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Finds a date like "Dec 9", "December 9th" or "12/9" and returns it as YYYY-MM-DD near `today`. */
export function findDate(s: string, today: string): string | null {
  const year = Number(today.slice(0, 4));
  let m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  let month: number | null = null;
  let day: number | null = null;
  if (m) {
    month = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1;
    day = Number(m[2]);
  } else {
    m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (m) {
      month = Number(m[1]);
      day = Number(m[2]);
    }
  }
  if (!month || !day || month > 12 || day > 31) return null;
  let y = year;
  const candidate = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // A date more than ~4 months in the past most likely means next year.
  if (Date.parse(candidate) < Date.parse(today) - 120 * 86400000) y += 1;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A promise with a date: "we'll land the rate-limit change by Dec 9". */
export function findPromise(s: string, today: string): { title: string; due: string } | null {
  const m = s.match(/\b(?:we'll|we will|will|we're going to|going to|plan to|committed to|commit to)\s+(.+?)\s+(?:by|on|before|for)\s+([A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2})/i);
  if (!m) return null;
  const due = findDate(m[2], today);
  if (!due) return null;
  const title = capitalize(m[1].replace(/^(?:have|get|ship|land|deliver|finish|send)\s+/i, (w) => w).replace(/[,.;]+$/, ""));
  return { title, due };
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shorten(s: string, max: number): string {
  const clean = s.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const at = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf("; "), cut.lastIndexOf(" - "));
  return (at > max * 0.5 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(" "))).replace(/[,;:\s]+$/, "") + "…";
}

export function firstSentence(s: string): string {
  const m = s.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : s).trim();
}

/** Summary and Headline versions written only from the item's own text. */
export function levelTexts(text: string): { summary: string; headline: string } {
  const first = firstSentence(text);
  const summary = shorten(first, 140).replace(/([^.!?…])$/, "$1.");
  const headline = shorten(first.split(/[;:,]| because | so that | but /)[0], 60).replace(/[.]+$/, "");
  return { summary, headline };
}

/** Short versions of an answer: keep the sentence with a date or number, since that's usually the point. */
export function answerLevels(answer: string): { summary: string; headline: string } {
  const parts = answer.match(/[^.!?]+[.!?]?/g)?.map((x) => x.trim()).filter(Boolean) ?? [answer];
  const key = parts.find((p) => /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\d/i.test(p)) ?? parts[0];
  const summary = answer.length <= 160 ? answer : shorten(answer, 160);
  return { summary, headline: shorten(key, 60).replace(/[.]+$/, "") };
}

export interface Doc {
  ref: string;
  text: string;
}

/** Best published sources for a question, by word overlap. */
export function rank(question: string, docs: Doc[]): { doc: Doc; score: number }[] {
  const q = tokens(question);
  return docs
    .map((doc) => ({ doc, score: overlap(q, tokens(doc.text)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function asksForDate(question: string): boolean {
  return /^\s*(when|by when|what date|what's the date|eta|how soon)\b/i.test(question) || /\b(eta|land|ship|ready|done)\b.*\?\s*$/i.test(question) && /\bwhen\b/i.test(question);
}

export type ContextKind = "about" | "responsibility" | "capability" | "how_to_work" | "knows" | "system";
export interface ContextClaim {
  kind: ContextKind;
  title: string;
  body: string;
}

const tidy = (s: string, max = 80) => capitalize(shorten(s.replace(/[.!?]+$/, "").trim(), max));

/**
 * Lasting facts about a team in a piece of its own text: what it owns, runs, can help with, knows,
 * and how to ask it. Time-bound status ("lands Dec 9") is left to updates and answers.
 */
export function extractContext(input: { kind: string; text: string; question?: string; repo?: string }): ContextClaim[] {
  const out: ContextClaim[] = [];
  const add = (c: ContextClaim) => {
    if (c.title.length >= 3 && !out.some((o) => o.kind === c.kind && jaccard(tokens(o.title), tokens(c.title)) >= 0.5)) out.push(c);
  };
  for (const s of sentences(input.text)) {
    let m: RegExpMatchArray | null;
    if ((m = s.match(/\bwe (?:own|are responsible for|look after|are the owners? of)\s+(.+)$/i))) add({ kind: "responsibility", title: tidy(m[1]), body: s });
    else if ((m = s.match(/\bwe (?:run|operate|host|maintain)\s+(.+)$/i))) add({ kind: "system", title: tidy(m[1]), body: s });
    else if ((m = s.match(/\b(?:we can help (?:you )?with|happy to help with|we can help by)\s+(.+)$/i))) add({ kind: "capability", title: tidy(m[1]), body: s });
    else if (/\b(ask (?:us )?in #[\w-]+|post in #[\w-]+|file a ticket|page (?:the )?on-call|book (?:a|an) .+ in #[\w-]+|best way to (?:reach|ask) us)\b/i.test(s))
      add({ kind: "how_to_work", title: tidy(s, 90), body: s });
  }
  if (input.kind === "answer" && input.question) {
    const q = input.question.replace(/\?+\s*$/, "").trim();
    // The whole answer, so the agent can give the same answer next time.
    add({ kind: "knows", title: tidy(q, 90), body: shorten(input.text.trim(), 300) });
  }
  if ((input.kind === "pr" || input.kind === "coding_session") && input.repo) add({ kind: "system", title: input.repo, body: `Recent work: ${shorten(firstSentence(input.text), 160)}` });
  return out.slice(0, 5);
}
