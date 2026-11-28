import Link from "next/link";
import type { ChatMsg } from "@/lib/assistant";
import { Avatar } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { chatDecide, chatSend } from "@/app/actions";
import { FollowUp } from "@/components/FollowUp";
import { FullPathInput } from "@/components/Nav";
import { AnswerClaims } from "@/components/AnswerClaims";
import { RateAnswer } from "@/components/RateAnswer";
import { LiveTurn, Steps } from "./LiveTurn";
import { ScrollToEnd } from "./ScrollToEnd";

const backFor = (target: string) => (target === "me" ? "/messages" : `/messages?with=${encodeURIComponent(target)}`);

/** One conversation with an agent: messages, the sources each answer used, and actions to approve. */
export function ChatThread({ messages, me, empty, scope }: { messages: ChatMsg[]; me: string; empty: React.ReactNode; scope: "dock" | "page" }) {
  return (
    <ol className="chat-list" aria-live="polite">
      {messages.length === 0 && <li className="chat-empty">{empty}</li>}
      {messages.map((m) =>
        m.role === "user" ? (
          <li key={m.id} className="chat-msg user">
            <div className="chat-bubble">{m.text}</div>
          </li>
        ) : (
        <li key={m.id} className="chat-msg agent">
          <Avatar name={m.agentLabel ?? "Your Beacon agent"} agent size={24} />
          <div className="chat-body">
            {m.answer?.steps && m.answer.steps.length > 0 && <Steps steps={m.answer.steps.map((label) => ({ label, done: true }))} live={false} />}
            <div className="chat-text"><Markdown text={m.text} /></div>
            {m.answer && (m.answer.claims.length > 0 || m.answer.gaps.length > 0 || m.answer.clarify) && (
              <AnswerClaims
                claims={m.answer.claims}
                gaps={m.answer.gaps}
                followUp={
                  m.answer.clarify && (
                    <FollowUp
                      question={m.answer.clarify.question}
                      options={m.answer.clarify.options}
                      action={chatSend}
                      field="text"
                      done={m.answer.clarify.done}
                      hidden={<><FullPathInput /><input type="hidden" name="target" value={m.target} /><input type="hidden" name="replyTo" value={m.id} /></>}
                    />
                  )
                }
              />
            )}
            {m.answer?.questionId && m.answer.claims.length > 0 && <RateAnswer questionId={m.answer.questionId} back={backFor(m.target)} vote={m.answer.vote} />}
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
        ),
      )}
      <LiveTurn scope={scope} me={me} count={messages.length} />
      <ScrollToEnd count={messages.length} />
    </ol>
  );
}
