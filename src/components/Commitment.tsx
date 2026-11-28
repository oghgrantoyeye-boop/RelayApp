import type { CommitmentView } from "@/lib/commitments";
import { fmt } from "@/lib/clock";
import { LevelTag, StatePill, TeamChip } from "./ui";

/** One commitment, with the chain it depends on, all at the reader's level. */
export function CommitmentLine({ c, showWaiting = true }: { c: CommitmentView; showWaiting?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontWeight: 500 }}>{c.shown.title}</span>
        <LevelTag level={c.level} />
      </div>
      <div className="small muted row" style={{ gap: 6, marginTop: 3 }}>
        <TeamChip team={c.ownerUnit} />
        {showWaiting && c.waitingUnit && (
          <>
            <span>owes</span>
            <TeamChip team={c.waitingUnit} />
          </>
        )}
        <span>
          due {fmt(c.due)}
          {c.originalDue && ` (was ${fmt(c.originalDue)})`}
        </span>
        {c.ownerName && <span>· owner {c.ownerName}</span>}
      </div>
      {c.shown.reason && <div className="small muted" style={{ marginTop: 4 }}>{c.shown.reason}</div>}
      {c.blockedBy && (
        <div className="small muted" style={{ marginTop: 6, paddingLeft: 10, borderLeft: "2px solid var(--line)" }}>
          Depends on: {c.blockedBy.shown.title} ({c.blockedBy.ownerUnit.name}, due {fmt(c.blockedBy.due)}){" "}
          <StatePill state={c.blockedBy.state} daysLate={c.blockedBy.daysLate} />
          {c.blockedBy.blockedBy && (
            <div style={{ marginTop: 4 }}>
              which depends on: {c.blockedBy.blockedBy.shown.title} ({c.blockedBy.blockedBy.ownerUnit.name}, due {fmt(c.blockedBy.blockedBy.due)}){" "}
              <StatePill state={c.blockedBy.blockedBy.state} daysLate={c.blockedBy.blockedBy.daysLate} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
