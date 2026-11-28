"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * The message box. Enter sends, Shift+Enter adds a line. A guide link can fill it in with
 * ?agent=<question>&to=<agent id>; then the panel opens with the question ready to send.
 */
export function Composer({ action, target, from, placeholder, suggestions, names }: {
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

  useEffect(() => {
    if (prefill && ref.current) {
      ref.current.value = prefill;
      ref.current.focus();
    }
  }, [prefill]);

  return (
    <form action={action} className="composer">
      <input type="hidden" name="path" value={back} />
      <input type="hidden" name="target" value={to ?? target} />
      <input type="hidden" name="from" value={from} />
      {suggestions && suggestions.length > 0 && (
        <div className="chat-suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => { if (ref.current) { ref.current.value = s; ref.current.focus(); } }}>{s}</button>
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
        <button className="b bp sm" type="submit">Send</button>
      </div>
    </form>
  );
}
