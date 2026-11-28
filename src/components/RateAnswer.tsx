// T-21: the asker says whether the agent's answer helped. A thumbs down asks what was wrong and
// lowers Beacon's confidence in the context the answer used.
import { rateAnswerAction } from "@/app/actions/feedback";

export function RateAnswer({ questionId, back, vote }: { questionId: string; back: string; vote?: "up" | "down" | null }) {
  if (vote) {
    return <div className="small muted rate-answer">{vote === "up" ? "You said this helped." : "You said this didn't help. Thanks, Beacon will lean on it less."}</div>;
  }
  const hidden = (
    <>
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  return (
    <div className="row rate-answer" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
      <span className="small muted">Did this help?</span>
      <form action={rateAnswerAction}>{hidden}<input type="hidden" name="vote" value="up" /><button className="b sm" type="submit">Helpful</button></form>
      <details>
        <summary className="b sm">Not helpful</summary>
        <form action={rateAnswerAction} className="row" style={{ gap: 6, marginTop: 6 }}>
          {hidden}
          <input type="hidden" name="vote" value="down" />
          <input name="note" maxLength={600} placeholder="What was wrong or missing? (optional)" aria-label="What was wrong or missing" style={{ minWidth: 240 }} />
          <button className="b sm" type="submit">Send</button>
        </form>
      </details>
    </div>
  );
}
