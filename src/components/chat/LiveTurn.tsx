"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { Markdown } from "@/components/Markdown";

export interface LiveDetail {
  scope: string;
  text?: string;
  reply?: string;
  agentLabel?: string;
  steps?: { label: string; done: boolean }[];
  streaming?: boolean;
}

/** What the agent is doing right now: each step with a spinner, ticked when done. */
export function Steps({ steps, live }: { steps: { label: string; done: boolean }[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  const running = live && steps.some((s) => !s.done);
  if (!running && !open) {
    return (
      <button type="button" className="chat-steps-toggle" onClick={() => setOpen(true)}>
        {steps.length === 1 ? steps[0].label.replace(/^Checking/, "Checked").replace(/^Asking/, "Asked").replace(/^Looking/, "Looked") : `Used ${steps.length} steps`} ›
      </button>
    );
  }
  return (
    <ul className="chat-steps">
      {steps.map((s, i) => (
        <li key={i} className={s.done || !live ? "done" : "running"}>
          <span className="step-icon" aria-hidden="true">{s.done || !live ? "✓" : ""}</span>
          {s.label}
          {!s.done && live ? "…" : ""}
        </li>
      ))}
    </ul>
  );
}

/** The message just sent and the reply as it streams in, until the saved messages render. */
export function LiveTurn({ scope, count }: { scope: string; me?: string; count: number }) {
  const [turn, setTurn] = useState<LiveDetail | null>(null);
  const seen = useRef(count);
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<LiveDetail>).detail;
      if (d.scope !== scope) return;
      setTurn((t) => ({ ...t, ...d }));
    };
    window.addEventListener("beacon-chat", on);
    return () => window.removeEventListener("beacon-chat", on);
  }, [scope]);

  // The saved conversation arrived: the live copy steps aside.
  useEffect(() => {
    if (count !== seen.current) {
      seen.current = count;
      setTurn(null);
    }
  }, [count]);

  useEffect(() => {
    const box = end.current?.closest(".chat-scroll");
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [turn?.reply, turn?.text, turn?.steps?.length]);

  if (!turn?.text) return null;
  const waiting = turn.streaming && !turn.reply;
  return (
    <>
      <li className="chat-msg user">
        <div className="chat-bubble">{turn.text}</div>
      </li>
      <li className="chat-msg agent" ref={end}>
        <Avatar name={turn.agentLabel ?? "Your Beacon agent"} agent size={24} />
        <div className="chat-body">
          <Steps steps={turn.steps ?? []} live={!!turn.streaming} />
          {waiting && !(turn.steps ?? []).some((s) => !s.done) && (
            <div className="typing" aria-label="Thinking"><span /><span /><span /></div>
          )}
          {turn.reply && (
            <div className={`chat-text${turn.streaming ? " streaming" : ""}`}>
              <Markdown text={turn.streaming ? `${turn.reply}▍` : turn.reply} />
            </div>
          )}
        </div>
      </li>
    </>
  );
}
