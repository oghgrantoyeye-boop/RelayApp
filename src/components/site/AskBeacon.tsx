"use client";
import { useEffect, useState, type FormEvent } from "react";

interface Row {
  k: string;
  v: string;
  src?: string[];
}

// Scripted, illustrative answers about a fictional company. The real product answers from what
// it has learned about each team, limited to what the person asking may see, with a source per point.
const ANSWERS: { q: string; keys: string[]; rows: Row[] }[] = [
  {
    q: "Can Platform support single sign-on for a merchant admin console?",
    keys: ["sso", "sign", "platform", "support", "admin", "console"],
    rows: [
      { k: "Confirmed by Platform", v: "Platform owns sign-in and single sign-on for Northwind.", src: ["Platform's page · Nov 18"] },
      { k: "Learned", v: "SAML single sign-on already runs for internal tools like the admin dashboard.", src: ["Ken Watanabe's answer · Nov 20"] },
      { k: "Seen in GitHub", v: "Platform is moving sessions to short-lived tokens, which a new console would build on.", src: ["platform/auth PR #482 · Dec 2"] },
      { k: "Inference", v: "Supporting merchants' own identity providers is probably new work. No source says so directly." },
      { k: "Couldn't find", v: "Whether Platform has room for this next quarter. I've sent that part to Platform's team queue." },
    ],
  },
  {
    q: "Who owns data exports for merchants?",
    keys: ["who", "owns", "own", "export", "data", "owner"],
    rows: [
      { k: "Seen in GitHub", v: "Most recent changes to merchant exports came from Payments API.", src: ["payments/exports · 9 merged PRs since Oct"] },
      { k: "Learned", v: "Diego Alvarez answered two export questions last month.", src: ["Payments API answers · Nov 14, Nov 27"] },
      { k: "Not confirmed", v: "Payments API hasn't confirmed it owns exports, so I've asked them to." },
      { k: "How to ask", v: "Ask the Payments API agent. Anything it can't answer goes to its team queue." },
    ],
  },
  {
    q: "How does Platform want new services reviewed?",
    keys: ["how", "review", "service", "launch", "ask", "work"],
    rows: [
      { k: "Confirmed by Platform", v: "Ask the agent first. Book a one-hour launch review in #platform-asks.", src: ["Platform's page · Nov 18"] },
      { k: "Learned", v: "Reviews cover load testing, rate limits and on-call setup.", src: ["Lena Fischer's answers · Nov 26"] },
      { k: "Freshness", v: "The booking process was last mentioned Nov 12, so it may be out of date." },
    ],
  },
];

function pick(q: string) {
  const words = q.toLowerCase();
  let best = -1;
  let score = 0;
  ANSWERS.forEach((a, i) => {
    const s = a.keys.filter((k) => words.includes(k)).length;
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best;
}

export function AskBeacon({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState(ANSWERS[0].q);
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<"thinking" | "done" | "none">("done");

  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => setPhase(active < 0 ? "none" : "done"), 650);
    return () => clearTimeout(t);
  }, [phase, active]);

  const ask = (i: number, q?: string) => {
    setActive(i);
    if (q !== undefined) setInput(q);
    setPhase("thinking");
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(pick(input));
  };
  const answer = active >= 0 ? ANSWERS[active] : null;

  return (
    <div className="panel ask">
      <div className="panel-h">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#315efb" strokeWidth="2" aria-hidden="true"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
        Ask Beacon
        <span className="demo-label" style={{ marginLeft: "auto" }}>Illustrative answer</span>
      </div>
      {!compact && (
        <div className="ask-presets" role="group" aria-label="Example questions">
          {ANSWERS.map((a, i) => (
            <button key={i} type="button" aria-pressed={active === i} onClick={() => ask(i, a.q)}>{a.q}</button>
          ))}
        </div>
      )}
      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor={compact ? "ask-compact" : "ask-main"} className="sr-only">Ask a question</label>
        <input id={compact ? "ask-compact" : "ask-main"} value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" />
        <button className="btn btn-primary btn-sm" type="submit">Ask</button>
      </form>
      <div className="answer" aria-live="polite">
        {phase === "thinking" && (
          <div className="thinking"><i /><i /><i /> Reading what Beacon knows about the team…</div>
        )}
        {phase === "none" && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            This preview answers three example questions about a fictional company. Try one of the suggestions above.
          </p>
        )}
        {phase === "done" && answer &&
          answer.rows.slice(0, compact ? 3 : undefined).map((r, i) => (
            <div key={`${active}-${i}`} className="answer-row" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="k">{r.k}</div>
              <div className="v">
                {r.v}
                {r.src && (
                  <div className="src">
                    {r.src.map((s) => <span key={s} className="chip">{s}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
