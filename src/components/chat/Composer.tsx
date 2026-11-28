"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The message box. Enter sends, Shift+Enter adds a line. A guide link can fill it in with
 * ?agent=<question>&to=<agent id>; then the panel opens with the question ready to send.
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
  const prefill = from === "dock" ? params.get("agent") : null;
  const to = from === "dock" ? params.get("to") : null;
  const query = params.toString().replace(/(^|&)(agent|to|msg)=[^&]*/g, "").replace(/^&/, "");
  const back = `${path}${query ? `?${query}` : ""}`;

  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const emit = (detail: Record<string, unknown>) => window.dispatchEvent(new CustomEvent("beacon-chat", { detail: { scope: from, ...detail } }));

  /** Send without a page load, and show the reply as it's written. */
  async function send(text: string) {
    const to_ = to ?? target;
    setBusy(true);
    emit({ text, reply: "", agentLabel: to_ !== target && names?.[to_] ? names[to_] : agentLabel });
    if (ref.current) ref.current.value = "";
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target: to_, text, from }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += dec.decode(value, { stream: true });
        emit({ reply });
      }
      const sentTo = res.headers.get("x-beacon-target");
      if (from === "page" && sentTo && sentTo !== target) router.push(`/messages?with=${encodeURIComponent(sentTo)}`);
      else router.refresh();
    } catch (err) {
      emit({ reply: `Sorry, that didn't go through. ${(err as Error).message || "Try again."}` });
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  useEffect(() => {
    if (prefill && ref.current) {
      ref.current.value = prefill;
      ref.current.focus();
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
      {suggestions && suggestions.length > 0 && (
        <div className="chat-suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" disabled={busy} onClick={() => void send(s)}>{s}</button>
          ))}
        </div>
      )}
      {to && to !== target && names?.[to] && <div className="small muted" style={{ marginBottom: 4 }}>To: {names[to]}</div>}
      <div className="composer-box">
        <textarea
          ref={ref}
          name="text"
          rows={2}
          placeholder={placeholder}
          aria-label="Message"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (e.currentTarget.value.trim()) e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button className="b bp sm" type="submit" disabled={busy}>{busy ? "…" : "Send"}</button>
      </div>
    </form>
  );
}
