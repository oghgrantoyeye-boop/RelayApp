import type { ReactNode } from "react";
import { setPersona } from "@/app/actions";
import { Shell } from "@/app/components/Shell";
import { AiCard, Icon, LevelPill, Locked, Pill, Tag, TopBar, fmtTime, stateTone } from "@/app/components/ui";
import { appDb } from "@/lib/app-db";
import { type FieldView, PermissionError, readEntity } from "@/lib/entities";
import type { Level } from "@/lib/levels";
import type { ChecklistItem, Status } from "@/lib/render";
import { currentPersona } from "@/lib/session";
import { STATUS_KEYS, feedFor } from "@/lib/views";

export const dynamic = "force-dynamic";

const ROLES = [
  { id: "maya", label: "Product lead" },
  { id: "nina", label: "Compliance analyst" },
  { id: "summit", label: "Retail partner" },
];
const TRACK = ["kickoff", ...STATUS_KEYS];
const LIST_TYPES = new Set(["checklist", "decision"]);

export default async function InitiativePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const db = await appDb();
  const me = await currentPersona();
  const units = new Map((await db.query<{ id: string; name: string; color: string; kind: string }>("select id, name, color, kind from unit")).rows.map((u) => [u.id, u]));
  const myUnit = units.get(me.unit_id)!;

  const roleSwitch = (
    <>
      <span className="muted small" id="viewing-as">Viewing as</span>
      <form action={setPersona} className="roles" role="group" aria-labelledby="viewing-as">
        <input type="hidden" name="back" value={`/i/${ref}`} />
        {ROLES.map((r) => (
          <button key={r.id} name="member" value={r.id} aria-pressed={me.id === r.id}>
            {r.label}
          </button>
        ))}
        {!ROLES.some((r) => r.id === me.id) && <button aria-pressed="true" type="button">{me.name}</button>}
      </form>
    </>
  );

  let view;
  try {
    view = await readEntity(db, me.id, ref);
  } catch (e) {
    if (!(e instanceof PermissionError)) throw e;
    return (
      <Shell me={me} current="">
        <TopBar crumbs={[{ label: myUnit.kind === "public" ? "Your launches" : "Waiting on", href: "/" }, { label: ref }]}>{roleSwitch}</TopBar>
        <div className="page">
          <h1>Nothing to show</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {ref} doesn't exist, or it isn't shared with {me.name}. Relay gives the same answer either way, so nothing leaks.
          </p>
        </div>
      </Shell>
    );
  }
  const f = view.fields;
  const text = (k: string) => f[k]?.text ?? null;
  const visible = Object.values(f).filter((x) => !x.locked && x.text);
  const sources = [...new Set(visible.map((x) => x.owner_unit_id))].map((id) => ({ name: units.get(id)!.name, color: units.get(id)!.color }));
  const markings = [...new Set(visible.flatMap((x) => x.markings))];

  // The summary is built only from what this reader can see (the view is already filtered and rendered).
  const status = (k: string) => (f[k] && !f[k].locked ? (f[k].detail as Status | undefined) : undefined);
  // Headlines read "Compliance: changes requested"; the track already names the team.
  const shown = (k: string) => (f[k]?.text ?? "").replace(new RegExp(`^${units.get(f[k]?.owner_unit_id ?? "")?.name}: `), "").replace(/^./, (c) => c.toUpperCase());
  const blocked = TRACK.filter((k) => f[k] && !f[k].locked && /^waiting/i.test(shown(k)));
  const changes = TRACK.filter((k) => f[k] && !f[k].locked && /^changes requested/i.test(shown(k)));
  const summary: ReactNode[] = [];
  if (blocked.length)
    summary.push(
      <>
        <b>{blocked.map((k) => units.get(f[k].owner_unit_id)!.name).join(" and ")}</b> {blocked.length > 1 ? "are" : "is"} {shown(blocked[0]).replace(/^Waiting/, "waiting")}.
      </>,
    );
  if (changes.length)
    summary.push(
      <>
        {changes.map((k) => units.get(f[k].owner_unit_id)!.name).join(" and ")} requested changes{f.compliance_findings && !f.compliance_findings.locked && f.compliance_findings.text ? <> (<b>{(f.compliance_findings.text.match(/\n/g)?.length ?? 0) + 1} findings</b>)</> : null}.
      </>,
    );
  if (text("revised_due") && text("target_date"))
    summary.push(
      <>
        If revised files land by <b>{text("revised_due")}</b>, the launch can still make its <b>{text("target_date")}</b> target.
      </>,
    );
  else if (text("target_date")) summary.push(<>Target date is <b>{text("target_date")}</b>.</>);
  if (myUnit.kind === "public") summary.unshift(<>Here's where your launch stands with Larkspur.</>);
  if (!summary.length) summary.push(<>Nothing is blocked on this initiative right now.</>);

  const activity = (await feedFor(db, me, myUnit.kind, 200)).filter((a) => a.target === ref).slice(0, 10);
  const openItems = Object.values(f).filter((x) => LIST_TYPES.has(x.type));
  const props = Object.values(f).filter((x) => !LIST_TYPES.has(x.type) && !TRACK.includes(x.key) && x.key !== "name" && x.key !== "summary");

  return (
    <Shell me={me} current="">
      <TopBar crumbs={[{ label: myUnit.kind === "public" ? "Your launches" : "Waiting on", href: "/" }, { label: ref }]}>{roleSwitch}</TopBar>
      <div className="page stack">
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h1>{text("name") ?? ref}</h1>
            <span className="mono muted">{ref}</span>
            {text("holder") && <Tag color={[...units.values()].find((u) => u.name === text("holder"))?.color ?? "#999"}>Held by {text("holder")}</Tag>}
          </div>
          {text("summary") && <p className="muted" style={{ marginTop: 4 }}>{text("summary")}</p>}
        </div>

        <ol className="track" aria-label="Teams">
          {TRACK.map((k) => {
            const fv = f[k];
            if (!fv) return null;
            const unit = units.get(fv.owner_unit_id)!;
            const s = status(k);
            const t = shown(k);
            const tone = fv.locked ? "gray" : stateTone(s?.state ?? (/^waiting/i.test(t) ? "waiting" : /^changes/i.test(t) ? "changes_requested" : /^(approved|done)/i.test(t) ? "done" : /^in progress/i.test(t) ? "in_progress" : "not_started"));
            return (
              <li key={k}>
                <span className={`dot dot-${tone}`}>{tone === "green" && <Icon name="check" size={13} />}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{unit.name}</div>
                  {fv.locked ? <Locked /> : <div className={`small tone-${tone}`}>{t || "Not started"}</div>}
                  <div className="small muted"><LevelPill level={fv.level} /></div>
                </div>
              </li>
            );
          })}
        </ol>

        <AiCard title={myUnit.kind === "public" ? "Summary for you" : `Summary for ${me.name}`} sources={sources} markings={markings}>
          <p>{summary.map((s, i) => <span key={i}>{s} </span>)}</p>
        </AiCard>

        <div className="cols">
          <div className="col-main">
            <section className="card">
              <h2>Open items</h2>
              <ul className="list">
                {openItems.map((x) => (
                  <li key={x.key}>
                    <span style={{ minWidth: 110 }}>
                      <Tag color={units.get(x.owner_unit_id)!.color}>{units.get(x.owner_unit_id)!.name}</Tag>
                    </span>
                    <div className="grow">
                      <div style={{ fontWeight: 500 }}>{x.label}</div>
                      {x.locked ? (
                        <Locked />
                      ) : x.type === "checklist" && Array.isArray(x.detail) ? (
                        <ol style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                          {(x.detail as ChecklistItem[]).map((c) => (
                            <li key={c.n}>
                              {c.title ?? c.plain}
                              {c.ref && <span className="mono muted"> · {c.ref}</span>}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="preview" style={{ marginTop: 3 }}>{x.text ?? "Nothing yet"}</div>
                      )}
                      <div className="meta"><LevelPill level={x.level} /></div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Activity</h2>
                <span className="muted small">What Relay pushed to {myUnit.kind === "public" ? "you" : myUnit.name} about this initiative</span>
              </div>
              <ul className="list">
                {activity.map((a) => (
                  <li key={a.id}>
                    <span className="swatch" style={{ background: units.get(a.detail.from_unit)?.color, marginTop: 5 }} />
                    <div className="grow">
                      <div>
                        <span className="muted">{a.detail.field_label}:</span> {a.detail.text}
                      </div>
                      <div className="meta">
                        {units.get(a.detail.from_unit)?.name} · <LevelPill level={a.detail.level as Level} /> · {fmtTime(a.at)}
                      </div>
                    </div>
                  </li>
                ))}
                {activity.length === 0 && <li className="empty">Nothing pushed yet.</li>}
              </ul>
            </section>
          </div>

          <div className="col-side">
            <section className="card">
              <h2>Properties</h2>
              <dl className="props">
                {props.map((x: FieldView) => (
                  <div key={x.key}>
                    <dt>{x.label}</dt>
                    <dd>
                      {x.locked ? (
                        <Locked label="Internal" />
                      ) : (
                        <>
                          {x.text ?? "–"}
                          {x.markings.length > 0 && (
                            <div style={{ marginTop: 3 }}>
                              <Pill tone="red" dot={false}>
                                <Icon name="lock" size={12} /> {x.markings.join(", ")}
                              </Pill>
                            </div>
                          )}
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            {text("started_at") && (
              <p className="muted small">
                Started {text("started_at")}. Every field above was checked against {me.name}'s access on the server before it was sent.
              </p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

