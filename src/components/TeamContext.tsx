// "What Beacon knows about <team>": learned context grouped by kind, each entry tagged with where it
// came from. Team members can confirm, fix or remove an entry; everyone else reads it at its level.
import { Pill, type Tone } from "@/components/ui";
import { CONTEXT_KIND_LABEL, CONTEXT_KIND_ORDER, type ContextTag, type ContextView } from "@/lib/context";
import { LEVEL_LABEL, type Level } from "@/lib/permissions";
import { confirmContext, fixContext, removeContext, restoreContext } from "@/app/actions/context";

const TAG: Record<ContextTag, [Tone, string]> = {
  confirmed: ["green", "Confirmed"],
  learned: ["violet", "Learned"],
  seen: ["blue", "Seen in tools"],
};

function Hidden({ id, slug }: { id: string; slug: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={slug} />
    </>
  );
}

function Entry({ e, slug }: { e: ContextView; slug: string }) {
  const [tone, label] = TAG[e.tag];
  return (
    <li className="ctx-entry">
      <div className="grow">
        <div>
          <span className="ctx-kind">{CONTEXT_KIND_LABEL[e.kind] ?? e.kind}</span>
          <strong>{e.title}</strong> <Pill tone={tone}>{label}</Pill>
        </div>
        {e.body && <div className="muted">{e.body}</div>}
        <div className="small muted">{e.origin}{e.stale && " · may be out of date"}</div>
        {e.canEdit && (
          <details className="ctx-fix">
            <summary className="b sm">Fix</summary>
            <form action={fixContext} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              <Hidden id={e.id} slug={slug} />
              <label className="field"><span>What it is</span><input type="text" name="title" defaultValue={e.title} required maxLength={160} /></label>
              <label className="field"><span>Details</span><textarea name="body" rows={2} defaultValue={e.body ?? ""} maxLength={600} /></label>
              <div className="row"><button className="b bp sm" type="submit">Save fix</button></div>
            </form>
          </details>
        )}
      </div>
      {e.canEdit && (
        <div className="row ctx-acts">
          {e.tag !== "confirmed" && (
            <form action={confirmContext}><Hidden id={e.id} slug={slug} /><button className="b sm" type="submit">Looks right</button></form>
          )}
          <form action={removeContext}><Hidden id={e.id} slug={slug} /><button className="b sm" type="submit">Remove</button></form>
        </div>
      )}
    </li>
  );
}

export function TeamContext({ team, active, removed, isMember, level }: { team: { name: string; slug: string }; active: ContextView[]; removed: ContextView[]; isMember: boolean; level: Level | null }) {
  const kinds = CONTEXT_KIND_ORDER.filter((k) => active.some((e) => e.kind === k));
  return (
    <section className="card" id="knows" aria-label={`What Beacon knows about ${team.name}`}>
      <div className="row">
        <h2 style={{ margin: 0 }}>What Beacon knows about {team.name}</h2>
        <span className="small muted" style={{ marginLeft: "auto" }}>
          {isMember ? "You're on this team, so you see sources and can correct it." : level ? `You see this at ${LEVEL_LABEL[level]}.` : ""}
        </span>
      </div>
      <div className="row small" style={{ margin: "8px 0" }}>
        <Pill tone="green">Confirmed by the team</Pill>
        <Pill tone="violet">Learned from conversations</Pill>
        <Pill tone="blue">Seen in tools</Pill>
      </div>
      {active.length === 0 ? (
        <p className="muted">Beacon hasn&apos;t learned anything about {team.name} yet. It learns from the team&apos;s answers, updates, meetings and tools.</p>
      ) : (
        kinds.map((k) => (
          <ul key={k} className="list tight ctx-group">
            {active.filter((e) => e.kind === k).map((e) => <Entry key={e.id} e={e} slug={team.slug} />)}
          </ul>
        ))
      )}
      {isMember && (
        <p className="small muted" style={{ marginTop: 8 }}>Most of this was learned. You only need to fix what&apos;s wrong.</p>
      )}
      {isMember && removed.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="small muted">Removed ({removed.length})</summary>
          <ul className="list tight">
            {removed.map((e) => (
              <li key={e.id} className="ctx-entry">
                <div className="grow muted"><span className="ctx-kind">{CONTEXT_KIND_LABEL[e.kind] ?? e.kind}</span>{e.title}</div>
                <form action={restoreContext}><Hidden id={e.id} slug={team.slug} /><button className="b sm" type="submit">Undo</button></form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
