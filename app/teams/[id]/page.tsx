import { notFound } from "next/navigation";
import { createInterface, decideSuggestion, setInterfaceLevel } from "@/app/actions";
import { Shell } from "@/app/components/Shell";
import { Avatar, Icon, LevelPill, Locked, Pill, Tag, TopBar, fmtTime } from "@/app/components/ui";
import { appDb } from "@/lib/app-db";
import { ENTITY_TYPE, loadRaw } from "@/lib/entities";
import type { Level } from "@/lib/levels";
import { capByMarkings, loadPermissionContext } from "@/lib/permissions";
import { renderField } from "@/lib/render";
import { DEMO_REF } from "@/lib/seed";
import { currentPersona } from "@/lib/session";
import { feedFor } from "@/lib/views";

export const dynamic = "force-dynamic";

const TRIGGER: Record<string, string> = {
  on_change: "On change",
  "on_change+daily": "On change, daily digest",
  on_approval: "On approval",
  on_decision: "When decided",
  daily: "Daily digest",
  on_request: "On request",
};
const TEAM_BLURB: Record<string, string> = {
  product: "Owns each initiative: scope, dates, price and who is holding it. Shares the basics with every team.",
  engineering: "Designs and builds the product. Design notes stay in this team.",
  compliance: "Checks every product against safety and labeling rules. Raw review notes stay in this team.",
  supply: "Sources, builds and ships. Books freight once a product is certified.",
  marketing: "Plans launches and writes customer-facing copy.",
  sales: "Sells through retail partners and owns partner commitments.",
};

type IfaceRow = {
  id: string;
  from_unit_id: string;
  to_unit_id: string;
  field_id: string;
  level: Exclude<Level, "none">;
  trigger: string;
  status: string;
  label: string | null;
  note: string | null;
  sent: number;
};

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await appDb();
  const me = await currentPersona();
  const ctx = await loadPermissionContext(db, ENTITY_TYPE);
  const unit = ctx.units.get(id);
  if (!unit || unit.kind !== "internal") notFound();
  // Outside parties see only what teams share with them, never the teams' own setup.
  if (ctx.units.get(me.unit_id)?.kind === "public") notFound();
  const colors = new Map((await db.query<{ id: string; color: string }>("select id, color from unit")).rows.map((u) => [u.id, u.color]));
  const mine = me.unit_id === id;

  const ifaces = (
    await db.query<IfaceRow>(
      `select i.*, (select count(*)::int from audit_event a where a.action = 'share' and a.detail->>'interface' = i.id) as sent
       from interface i where (from_unit_id = $1 or to_unit_id = $1) and status <> 'declined' order by i.id`,
      [id],
    )
  ).rows;
  const outgoing = ifaces.filter((i) => i.from_unit_id === id && i.status === "active");
  const suggested = ifaces.filter((i) => i.from_unit_id === id && (i.status === "suggested" || i.status === "requested"));
  // Group what this team receives by sender, level and trigger, so the list stays short.
  const incoming = [
    ...ifaces
      .filter((i) => i.to_unit_id === id && i.status === "active")
      .reduce((m, i) => {
        const k = `${i.from_unit_id}|${i.level}|${i.trigger}`;
        const g = m.get(k) ?? { ...i, labels: [] as string[] };
        g.labels.push(i.label ?? (ctx.fields.get(i.field_id)!.type === "status" ? "Status" : ctx.fields.get(i.field_id)!.label));
        return m.set(k, g);
      }, new Map<string, IfaceRow & { labels: string[] }>())
      .values(),
  ];
  const members = (await db.query<{ id: string; kind: string; name: string; role: string; manager_id: string | null; config: any }>(
    "select id, kind, name, role, manager_id, config from member where unit_id = $1 order by kind desc, name", [id],
  )).rows;
  const feed = mine ? await feedFor(db, me, unit.kind, 12) : [];

  // Previews: what the receiving team would get for the demo initiative, at the interface's level after markings.
  const demo = await loadRaw(db, ctx, DEMO_REF);
  const preview = (i: IfaceRow) => {
    const field = ctx.fields.get(i.field_id)!;
    if (!demo) return null;
    const target = ctx.units.get(i.to_unit_id)!;
    if (target.kind === "public" && !demo.ref.external_owner_id) return null;
    const level = capByMarkings(ctx, i.to_unit_id, demo.ref, field, i.level);
    return { level, text: renderField(field.type, demo.values.get(field.id), level).text };
  };
  const unitTag = (uid: string) => <Tag color={colors.get(uid) ?? "#999"}>{ctx.units.get(uid)?.name}</Tag>;
  const ownFields = [...ctx.fields.values()].filter((f) => f.owner_unit_id === id);

  return (
    <Shell me={me} current={id}>
      <TopBar crumbs={[{ label: "Teams" }, { label: unit.name }]}>
        {mine ? <Pill tone="blue" dot={false}>You're on this team</Pill> : <span className="muted small">Viewing as {me.name}. Only {unit.name} members can change what it shares.</span>}
      </TopBar>
      <div className="page">
        <div className="page-head">
          <span className="unit-mark" style={{ background: colors.get(id) }} />
          <div>
            <h1>{unit.name}</h1>
            <p>{TEAM_BLURB[id]}</p>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Pill dot={false}>
              {members.filter((m) => m.kind === "person").length} people
              {members.some((m) => m.kind === "agent") ? `, ${members.filter((m) => m.kind === "agent").length} agent` : ""}
            </Pill>
          </span>
        </div>

        <div className="cols">
          <div className="col-main">
            {suggested.map((s) => {
              const field = ctx.fields.get(s.field_id)!;
              return (
                <section key={s.id} className="suggestion" aria-label="Suggested interface">
                  <div className="section-head">
                    <Pill tone="violet" dot={false}>
                      <Icon name="spark" size={12} /> Suggested
                    </Pill>
                    <h2>
                      Share {field.label.toLowerCase()} with {ctx.units.get(s.to_unit_id)?.name}
                    </h2>
                  </div>
                  <p>{s.note}</p>
                  <div className="actions">
                    {mine ? (
                      <>
                        <form action={decideSuggestion} className="inline-form">
                          <input type="hidden" name="id" value={s.id} />
                          <button className="b bp" name="choice" value="approve">Approve</button>
                          <button className="b" name="choice" value="summary">Approve as summary</button>
                          <button className="b" name="choice" value="decline">Decline</button>
                        </form>
                      </>
                    ) : (
                      <span className="muted small">Waiting for a {unit.name} member to decide.</span>
                    )}
                  </div>
                </section>
              );
            })}

            <section>
              <div className="section-head">
                <h2>What {unit.name} shares</h2>
                <span className="muted small">Relay sends each update at the agreed level the moment its trigger fires. Nobody has to ask.</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>With</th>
                      <th>What</th>
                      <th>Level</th>
                      <th>What they receive on {DEMO_REF}</th>
                      <th>When</th>
                      <th>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outgoing.map((i) => {
                      const field = ctx.fields.get(i.field_id)!;
                      const p = preview(i);
                      return (
                        <tr key={i.id}>
                          <td>{unitTag(i.to_unit_id)}</td>
                          <td>{i.label ?? (field.type === "status" ? "Status" : field.label)}</td>
                          <td>
                            {mine ? (
                              <form action={setInterfaceLevel} className="inline-form">
                                <input type="hidden" name="id" value={i.id} />
                                <select className="b b-sm" name="level" defaultValue={i.level} aria-label={`Level for ${field.label} to ${ctx.units.get(i.to_unit_id)?.name}`}>
                                  <option value="full">Full detail</option>
                                  <option value="summary">Summary</option>
                                  <option value="status">Status only</option>
                                  <option value="headline">Headline</option>
                                  <option value="none">Stop sharing</option>
                                </select>
                                <button className="b b-sm">Save</button>
                              </form>
                            ) : (
                              <LevelPill level={i.level} />
                            )}
                            {p && p.level !== i.level && (
                              <div className="small tone-red" style={{ marginTop: 4 }}>
                                Capped at {p.level === "none" ? "not shared" : p.level} by a marking
                              </div>
                            )}
                          </td>
                          <td>{mine ? (p?.text ? <span className="preview">{p.text}</span> : <span className="muted">–</span>) : <Locked label="Visible to team members" />}</td>
                          <td className="muted" style={{ whiteSpace: "nowrap" }}>{TRIGGER[i.trigger] ?? i.trigger}</td>
                          <td className="mono muted">{i.sent || "–"}</td>
                        </tr>
                      );
                    })}
                    {outgoing.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty">Nothing shared yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {mine && ownFields.length > 0 && (
                <form action={createInterface} className="new-iface" aria-label="New interface">
                  <span className="muted small">New interface:</span>
                  <select name="field" aria-label="Field">
                    {ownFields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <span className="muted small">to</span>
                  <select name="to" aria-label="Team">
                    {[...ctx.units.values()].filter((u) => u.id !== id).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <select name="level" aria-label="Level" defaultValue="summary">
                    <option value="full">Full detail</option>
                    <option value="summary">Summary</option>
                    <option value="status">Status only</option>
                    <option value="headline">Headline</option>
                  </select>
                  <select name="trigger" aria-label="When" defaultValue="on_change">
                    <option value="on_change">On change</option>
                    <option value="on_change+daily">On change, daily digest</option>
                    <option value="on_approval">On approval</option>
                  </select>
                  <button className="b bp">
                    <Icon name="plus" size={14} />
                    Share
                  </button>
                </form>
              )}
            </section>

            <section>
              <div className="section-head">
                <h2>What {unit.name} receives</h2>
                <span className="muted small">Other teams' interfaces addressed to this team.</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>What</th>
                      <th>Level</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incoming.map((i) => (
                      <tr key={i.id}>
                        <td>{unitTag(i.from_unit_id)}</td>
                        <td>{i.labels.join(", ")}</td>
                        <td><LevelPill level={i.level} /></td>
                        <td className="muted">{TRIGGER[i.trigger] ?? i.trigger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="col-side">
            <section className="card">
              <div className="card-head">
                <h2>Feed</h2>
                <span className="muted small">Pushed to {unit.name}</span>
              </div>
              {mine ? (
                <ul className="list">
                  {feed.map((f) => (
                    <li key={f.id}>
                      <span className="swatch" style={{ background: colors.get(f.detail.from_unit), marginTop: 5 }} />
                      <div className="grow">
                        <div>
                          <a href={`/i/${f.target}`}>{f.detail.entity_name}</a>: <span className="muted">{f.detail.field_label}</span>
                        </div>
                        <div className="preview" style={{ marginTop: 3 }}>{f.detail.text}</div>
                        <div className="meta">
                          {ctx.units.get(f.detail.from_unit)?.name} · <LevelPill level={f.detail.level as Level} /> · {fmtTime(f.at)}
                        </div>
                      </div>
                    </li>
                  ))}
                  {feed.length === 0 && <li className="empty">Nothing yet.</li>}
                </ul>
              ) : (
                <Locked label={`Only ${unit.name} members see this feed`} />
              )}
            </section>

            <section className="card">
              <h2>Members</h2>
              <ul className="list">
                {members.map((m) => (
                  <li key={m.id}>
                    <Avatar name={m.name} agent={m.kind === "agent"} size={28} />
                    <div className="grow">
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                        {m.kind === "agent" && <Pill tone="violet" dot={false}>Agent</Pill>}
                      </div>
                      <div className="muted small">{m.role}</div>
                      {m.kind === "agent" && (
                        <dl className="agent">
                          <dt>Manager</dt>
                          <dd>{ctx.members.get(m.manager_id ?? "")?.name}</dd>
                          <dt>Sees</dt>
                          <dd>{unit.name} data, and never more than the person it works for</dd>
                          <dt>Runs</dt>
                          <dd>When Engineering submits or resubmits files</dd>
                          <dt>Needs approval to</dt>
                          <dd>Send anything outside the team or change an initiative</dd>
                          <dt>Budget</dt>
                          <dd>
                            ${m.config?.budget?.used_usd} of ${m.config?.budget?.monthly_usd} this month
                            <div className="bar" style={{ marginTop: 4 }}>
                              <span style={{ width: `${(100 * m.config?.budget?.used_usd) / m.config?.budget?.monthly_usd}%`, background: "var(--violet-dot)" }} />
                            </div>
                          </dd>
                        </dl>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
