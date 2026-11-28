// An agent's answer, one claim at a time: each says whether the team confirmed it, Beacon learned
// it, a tool showed it, or Beacon inferred it, with its date and source. Then what it couldn't find.
import Link from "next/link";
import { Pill, type Tone } from "@/components/ui";
import type { ClaimTag, ClaimView } from "@/lib/agent";

const TAG: Record<ClaimTag, [Tone, string]> = {
  confirmed: ["green", "Confirmed"],
  learned: ["violet", "Learned"],
  seen: ["blue", "Seen in tools"],
  inference: ["amber", "Beacon's inference"],
};

import { fmt as day } from "@/lib/clock";

export function AnswerClaims({ claims, gaps, followUp }: { claims: ClaimView[]; gaps: string[]; followUp?: React.ReactNode }) {
  return (
    <div className="claims">
      {claims.map((c, i) => {
        const [tone, label] = TAG[c.tag];
        return (
          <div key={i} className="claim">
            <div>{c.text}</div>
            <div className="row small muted claim-meta">
              <Pill tone={tone}>{label}</Pill>
              {c.source && (c.source.href
                ? <Link href={c.source.href} title={c.source.text}>{c.source.label}</Link>
                : <span title={c.source.text}>{c.source.label}</span>)}
              {c.date && !c.source?.label.endsWith(day(c.date)) && <span>{day(c.date)}</span>}
              {c.stale && <span>may be out of date</span>}
              {c.tag === "inference" && <span>No source says this directly</span>}
            </div>
          </div>
        );
      })}
      {gaps.length > 0 && (
        <div className="claim-gap small">
          <strong>What I couldn&apos;t find:</strong> {gaps.join(" ")}
        </div>
      )}
      {followUp}
    </div>
  );
}
