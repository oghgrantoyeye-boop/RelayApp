import Link from "next/link";
import type { ChatMsg } from "@/lib/assistant";
import { Avatar } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { chatDecide } from "@/app/actions";
import { FullPathInput } from "@/components/Nav";
import { AnswerClaims } from "@/components/AnswerClaims";

/** One conversation with an agent: messages, the sources each answer used, and actions to approve. */
export function ChatThread({ messages, me, empty }: { messages: ChatMsg[]; me: string; empty: React.ReactNode }) {
  if (messages.length === 0) return <div className="chat-empty">{empty}</div>;
  return (
    <ol className="chat-list" aria-live="polite">
      {messages.map((m) => (
        <li key={m.id} className={`chat-msg ${m.role}`}>
          <Avatar name={m.role === "user" ? me : m.agentLabel ?? "Your Beacon agent"} agent={m.role === "agent"} size={26} />
          <div className="chat-body">
            <div className="chat-who">{m.role === "user" ? "You" : m.agentLabel}</div>
            <div className="chat-text">{m.role === "agent" ? <Markdown text={m.text} /> : <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.text}</p>}</div>
            {m.answer && <AnswerClaims claims={m.answer.claims} gaps={m.answer.gaps} />}
            {m.refs.length > 0 && (
              <div className="chat-refs">
                {m.refs.map((r, i) => (
                  <Link key={i} href={r.href} className="chip" title={r.detail}>{r.label}</Link>
                ))}
              </div>
            )}
            {m.actions.map((a) => (
              <div key={a.id} className={`chat-action ${a.status}`}>
                <div className="small" style={{ fontWeight: 500 }}>{a.status === "proposed" ? "Needs your OK" : a.status === "approved" ? "Approved" : "Dismissed"}: {a.label}</div>
                <div className="small muted">{a.result ?? a.detail}</div>
                {a.status === "proposed" && (
                  <form action={chatDecide} className="row" style={{ gap: 6, marginTop: 6 }}>
                    <FullPathInput />
                    <input type="hidden" name="messageId" value={m.id} />
                    <input type="hidden" name="actionId" value={a.id} />
                    <button className="b sm bp" name="op" value="approve" type="submit">Approve</button>
                    <button className="b sm" name="op" value="dismiss" type="submit">Not now</button>
                  </form>
                )}
                {a.href && <Link href={a.href} className="small" style={{ color: "var(--blue)" }}>Open the task →</Link>}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
