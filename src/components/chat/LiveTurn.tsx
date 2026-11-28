"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { Markdown } from "@/components/Markdown";

export interface LiveDetail {
  scope: string;
  text?: string;
  reply?: string;
  agentLabel?: string;
  done?: boolean;
}

/** The message just sent and the reply as it streams in, until the saved messages render. */
export function LiveTurn({ scope, me, count }: { scope: string; me: string; count: number }) {
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
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turn?.reply, turn?.text]);

  if (!turn?.text) return null;
  return (
    <>
      <li className="chat-msg user">
        <Avatar name={me} size={26} />
        <div className="chat-body">
          <div className="chat-who">You</div>
          <div className="chat-text"><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{turn.text}</p></div>
        </div>
      </li>
      <li className="chat-msg agent" ref={end}>
        <Avatar name={turn.agentLabel ?? "Your Beacon agent"} agent size={26} />
        <div className="chat-body">
          <div className="chat-who">{turn.agentLabel ?? "Your Beacon agent"}</div>
          <div className="chat-text">
            {turn.reply ? <Markdown text={turn.reply} /> : <p className="muted typing" style={{ margin: 0 }}>Thinking…</p>}
          </div>
        </div>
      </li>
    </>
  );
}
