// An agent's one follow-up question, with its suggested replies as buttons and room to type your
// own. The form posts to whichever action continues the conversation where it's shown.
import type { ReactNode } from "react";

export function FollowUp({
  question,
  options,
  action,
  hidden,
  field,
  done,
}: {
  question: string;
  options: string[];
  action: (form: FormData) => Promise<void>;
  /** Hidden inputs that say which question or message this replies to. */
  hidden: ReactNode;
  /** The name of the text field the action reads. */
  field: string;
  done?: boolean;
}) {
  return (
    <div className="followup">
      {question && <div style={{ fontWeight: 500 }}>{question}</div>}
      {done ? (
        <div className="small muted">You replied.</div>
      ) : (
        <>
          <form action={action} className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {hidden}
            {options.map((o) => (
              <button key={o} className="b sm" type="submit" name={field} value={o}>{o}</button>
            ))}
          </form>
          <form action={action} className="row" style={{ gap: 6, marginTop: 6 }}>
            {hidden}
            <input type="text" name={field} placeholder="Or say it in your own words" aria-label="Your reply" style={{ flex: 1 }} />
            <button className="b sm" type="submit">Reply</button>
          </form>
        </>
      )}
    </div>
  );
}
