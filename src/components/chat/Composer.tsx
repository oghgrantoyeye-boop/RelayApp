"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LiveDetail } from "./LiveTurn";

/**
 * The message box. Enter sends, Shift+Enter adds a line, and the box grows as you type. While a
 * reply streams, Send becomes Stop. A guide link can fill it in with ?agent=<question>&to=<agent id>.
 */
export function Composer({ action, target, from, placeholder, suggestions, names, agentLabel }: {
  /** Who answers, for the reply while it streams. */
  agentLabel?: string;
  action: (form: FormData) => Promise<void>;
  /** Agent names by id, to say who a prefilled question goes to. */
  names?: Record<string, string>;
  target: string;
  from: "dock" | "page";
  placeholder: string;
  suggestions?: string[];
}) {
  const path = usePathname();
  const params = useSearchParams();
  const ref = useRef<HTMLTextAreaElement>(null);
  const stopper = useRef<AbortController | null>(null);
  const prefill = from === "dock" ? params.get("agent") : null;
  const to = from === "dock" ? params.get("to") : null;
  const query = params.toString().replace(/(^|&)(agent|to|msg)=[^&]*/g, "").replace(/^&/, "");
  const back = `${path}${query ? `?${query}` : ""}`;

  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hasText, setHasText] = useState(false);
  const emit = (detail: Omit<LiveDetail, "scope">) => window.dispatchEvent(new CustomEvent("beacon-chat", { detail: { scope: from, ...detail } }));

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    setHasText(!!el.value.trim());
  };

  /** Send without a page load, and show the reply and the agent's steps as they happen. */
  async function send(text: string) {
    const to_ = to ?? target;
    const ctl = new AbortController();
    stopper.current = ctl;
    setBusy(true);
    emit({ text, reply: "", steps: [], agentLabel: to_ !== target && names?.[to_] ? names[to_] : agentLabel, streaming: true });
    if (ref.current) ref.current.value = "";
    grow();
    let reply = "";
    const steps: { label: string; done: boolean }[] = [];
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: to_, text, from }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { t: string; v: string; done?: boolean };
          if (ev.t === "d" || ev.t === "e") reply += ev.t === "e" && reply ? `\n\n${ev.v}` : ev.v;
          if (ev.t === "s") {
            const s = steps.find((x) => x.label === ev.v && !x.done);
            if (s && ev.done) s.done = true;
            else if (!ev.done) steps.push({ label: ev.v, done: false });
          }
          emit({ reply, steps: steps.map((s) => ({ ...s })) });
        }
      }
      emit({ streaming: false });
      const sentTo = res.headers.get("x-beacon-target");
      if (from === "page" && sentTo && sentTo !== target) router.push(`/messages?with=${encodeURIComponent(sentTo)}`);
      else router.refresh();
    } catch (err) {
      if (ctl.signal.aborted) {
        emit({ reply: reply || "_Stopped._", streaming: false });
        // The server keeps what was written; show the saved copy shortly.
        setTimeout(() => router.refresh(), 600);
      } else {
        emit({ reply: `${reply}${reply ? "\n\n" : ""}Sorry, that didn't go through. ${(err as Error).message || "Try again."}`, streaming: false });
      }
    } finally {
      stopper.current = null;
      setBusy(false);
      ref.current?.focus();
    }
  }

  useEffect(() => {
    if (prefill && ref.current) {
      ref.current.value = prefill;
      ref.current.focus();
      grow();
    }
  }, [prefill]);

  return (
    <form
      action={action}
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        const text = ref.current?.value.trim();
        if (text && !busy) void send(text);
      }}
    >
      <input type="hidden" name="path" value={back} />
      <input type="hidden" name="target" value={to ?? target} />
      <input type="hidden" name="from" value={from} />
      {suggestions && suggestions.length > 0 && !busy && (
        <div className="chat-suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => void send(s)}>{s}</button>
          ))}
        </div>
      )}
      {to && to !== target && names?.[to] && <div className="small muted" style={{ marginBottom: 4 }}>To: {names[to]}</div>}
      <div className="composer-box">
        <textarea
          ref={ref}
          name="text"
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          onInput={grow}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (e.currentTarget.value.trim() && !busy) e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {busy ? (
          <button className="send-btn stop" type="button" aria-label="Stop" title="Stop" onClick={() => stopper.current?.abort()}>
            <span className="stop-square" />
          </button>
        ) : (
          <button className="send-btn" type="submit" aria-label="Send" title="Send (Enter)" disabled={!hasText}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
      <div className="composer-hint">Enter to send · Shift+Enter for a new line</div>
    </form>
  );
}
