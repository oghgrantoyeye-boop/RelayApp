"use client";
import { useEffect, useState, type FormEvent } from "react";

interface Row {
  k: string;
  v: string;
  src?: string[];
}

// Scripted, illustrative answers about a fictional company. The real product answers from an
// organization's own connected context, limited to what the person asking may see.
const ANSWERS: { q: string; keys: string[]; rows: Row[] }[] = [
  {
    q: "What's blocking the payments launch?",
    keys: ["block", "launch", "payment", "late", "delay", "risk"],
    rows: [
      { k: "Current blocker", v: "Per-merchant rate limits slipped from Dec 5. A memory-leak fix is in review, and Platform is now targeting Dec 9.", src: ["PLAT-142 · tickets", "Platform update · Dec 4"] },
      { k: "Responsible team", v: "Platform. Aisha Bello owns rate limits; Marcus Johnson leads the team." },
      { k: "Decision", v: "Payments keeps webhook retries behind a flag until the new limits are live.", src: ["Platform × Payments meeting · Dec 4"] },
      { k: "Downstream impact", v: "Webhook retries (Payments, due Dec 12) → 'Reliable payments' launch (Growth, Dec 15) → Sales' enterprise calls next week." },
      { k: "Suggested next action", v: "Ask Platform to confirm Dec 9 after the 48-hour soak test, and have Growth prepare the Dec 17 email fallback now." },
    ],
  },
  {
    q: "What changed this week that affects Sales?",
    keys: ["sales", "changed", "week", "affect", "new"],
    rows: [
      { k: "Decisions", v: "If retries aren't live by Dec 12, the launch email moves to Dec 17; the webinar stays on Dec 15.", src: ["Growth launch review · Dec 5"] },
      { k: "Risks", v: "Webhook retries are at risk because of Platform's rate-limit change.", src: ["Payments update · Dec 4"] },
      { k: "Waiting on Sales", v: "Product needs enterprise customer requirements by Dec 10." },
      { k: "Suggested next action", v: "Hold launch-date promises on enterprise calls until Platform confirms Dec 9." },
    ],
  },
  {
    q: "Who should I ask about webhook retries?",
    keys: ["who", "ask", "webhook", "retries", "owner", "own"],
    rows: [
      { k: "Owner", v: "Priya Raman, Payments API. She owns webhooks and retries." },
      { k: "Already published", v: "Retries cover payments and refunds at launch; payouts follow in January.", src: ["Payments API answer · Nov 18"] },
      { k: "How to ask", v: "Ask the Payments API agent first. If it can't answer, it routes your question to Priya, in one batch with similar questions." },
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
          <div className="thinking"><i /><i /><i /> Reading what each team has shared with you…</div>
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
