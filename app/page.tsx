import { Shell } from "@/app/components/Shell";
import { AiCard, Icon, LevelPill, Metric, Pill, Tag, TopBar, fmtDay, fmtTime, stateTone } from "@/app/components/ui";
import { appDb } from "@/lib/app-db";
import type { Level } from "@/lib/levels";
import { DEMO_TODAY } from "@/lib/seed";
import { currentPersona } from "@/lib/session";
import { type Row, TARGET_DAYS, feedFor, overview } from "@/lib/views";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "blocked", label: "Blocked" },
  { id: "late", label: "Past target" },
  { id: "mine", label: "Held by your team" },
] as const;

function MiniTrack({ row }: { row: Row }) {
  return (
    <span className="track-mini" role="img" aria-label={row.statuses.map((s) => `${s.unit}: ${s.text ?? "not shared"}`).join(", ")}>
      {row.statuses.map((s) => (
        <span key={s.key} title={`${s.unit}: ${s.text ?? "not shared"}`} style={{ background: `var(--${stateTone(s.state)}-dot)`, opacity: s.state === "locked" ? 0.35 : 1 }} />
      ))}
    </span>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = "all" } = await searchParams;
  const db = await appDb();
  const me = await currentPersona();
  const { ctx, rows, metrics } = await overview(db, me.id);
  const myUnit = ctx.units.get(me.unit_id)!;
  const colors = new Map((await db.query<{ id: string; name: string; color: string }>("select id, name, color from unit")).rows.flatMap((u) => [[u.id, u.color], [u.name, u.color]] as [string, string][]));
  const feed = await feedFor(db, me, myUnit.kind, 8);
  const today = new Date(`${DEMO_TODAY}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  if (myUnit.kind === "public") return <PartnerHome me={me} rows={rows} feed={feed} today={today} />;

  // Product owns every initiative, so it waits on every blocked handoff.
  const ownsAll = me.unit_id === "product";
  const waitingOnOthers = rows
    .flatMap((r) => r.waiting.filter((w) => ownsAll || w.waiter_id === me.unit_id).map((w) => ({ r, w })))
    .sort((a, b) => (a.w.since ?? "").localeCompare(b.w.since ?? ""));
  const waitingOnUs = rows.flatMap((r) => r.waiting.filter((w) => w.on_id === me.unit_id).map((w) => ({ r, w })));
  const [topHolder, topCount] = metrics.holders[0] ?? ["", 0];
  const topBlocked = metrics.blocked_by.find(([u]) => u === topHolder)?.[1] ?? 0;
  const mineHeld = rows.filter((r) => r.holder === myUnit.name).length;

  const order = (r: Row) => (r.ref === "LK-014" ? -1 : r.waiting.length ? 0 : 1);
  const shown = [...rows].sort((a, b) => order(a) - order(b) || (b.days_open ?? 0) - (a.days_open ?? 0)).filter((r) =>
    filter === "blocked" ? r.waiting.length > 0 : filter === "late" ? (r.days_open ?? 0) > TARGET_DAYS : filter === "mine" ? r.holder === myUnit.name : true,
  );
  const counts: Record<string, number> = {
    all: rows.length,
    blocked: rows.filter((r) => r.waiting.length > 0).length,
    late: metrics.past_target,
    mine: mineHeld,
  };

  return (
    <Shell me={me} current="home">
      <TopBar crumbs={[{ label: "Waiting on" }]}>
        <span className="muted small">
          <Icon name="clock" size={13} /> {today} (demo date)
        </span>
      </TopBar>
      <div className="page stack">
        <AiCard
          title="Morning summary"
          sources={[...new Set([topHolder, ...waitingOnOthers.map((x) => x.w.on), "Product"])].filter(Boolean).map((n) => ({ name: n, color: colors.get(n) ?? "#999" }))}
        >
          <p>
            <b>{topHolder}</b> is the bottleneck. It is holding <b>{topCount} of {metrics.open}</b> open initiatives, more than any other team, and{" "}
            <b>{topBlocked}</b> of the <b>{metrics.blocked}</b> blocked handoffs are waiting on it. <b>{metrics.past_target}</b> initiatives are past the {TARGET_DAYS}-day target.
          </p>
          {waitingOnOthers.length > 0 && (
            <p>
              {ownsAll ? "Your initiatives are" : "Your team is"} waiting on <b>{waitingOnOthers.length}</b> handoff{waitingOnOthers.length === 1 ? "" : "s"}. The oldest is{" "}
              <a href={`/i/${waitingOnOthers[0].r.ref}`}>{waitingOnOthers[0].r.name}</a>, held by {waitingOnOthers[0].w.on}
              {waitingOnOthers[0].w.since ? ` since ${fmtDay(waitingOnOthers[0].w.since)}` : ""}.
            </p>
          )}
          {waitingOnUs.length > 0 && (
            <p>
              <b>{waitingOnUs.length}</b> other team{waitingOnUs.length === 1 ? " is" : "s are"} waiting on {myUnit.name}.
            </p>
          )}
        </AiCard>

        <div className="metrics">
          <Metric label="Open initiatives" value={metrics.open} note={`${mineHeld} held by ${myUnit.name}`} />
          <Metric label="Median days open" value={metrics.median_days ?? "–"} note={`Target ${TARGET_DAYS}`} tone={(metrics.median_days ?? 0) > TARGET_DAYS ? "red" : "green"} />
          <Metric label="Handoff rounds" value={metrics.rounds?.toFixed(1) ?? "–"} note="Down from 2.8" tone="green" />
          <Metric label="Blocked between teams" value={metrics.blocked} note={metrics.blocked_by.map(([u, n]) => `${n} on ${u}`).slice(0, 2).join(", ")} tone="amber" />
        </div>

        <div className="cols">
          <div className="col-main">
            <section className="card">
              <div className="card-head">
                <h2>{ownsAll ? "Blocked handoffs on your initiatives" : `${myUnit.name} is waiting on`}</h2>
                <span className="muted small">Who holds it and when it should land</span>
              </div>
              {!ownsAll && waitingOnUs.length === 0 && waitingOnOthers.length === 0 ? (
                <p className="empty">Nothing. {myUnit.name} isn't blocked on another team right now.</p>
              ) : waitingOnOthers.length === 0 ? (
                <p className="empty">Nothing. {myUnit.name} isn't blocked on another team right now.</p>
              ) : (
                <ul className="list">
                  {waitingOnOthers.map(({ r, w }) => (
                    <li key={r.ref + w.on_id}>
                      <Pill tone="amber">{ownsAll ? `${w.waiter} waiting` : "Waiting"}</Pill>
                      <div className="grow">
                        <a href={`/i/${r.ref}`} style={{ fontWeight: 500 }}>{r.name}</a>
                        <div className="meta">
                          <Tag color={colors.get(w.on_id) ?? "#999"}>{w.on}</Tag>
                          {w.since && <>since {fmtDay(w.since)}</>}
                          {w.days_left !== null && <> · should land in about {w.days_left} days</>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Waiting on {myUnit.name}</h2>
                <span className="muted small">Teams blocked until you deliver</span>
              </div>
              {waitingOnUs.length === 0 ? (
                <p className="empty">No team is waiting on {myUnit.name}.</p>
              ) : (
                <ul className="list">
                  {waitingOnUs.map(({ r, w }) => (
                    <li key={r.ref + w.waiter}>
                      <Pill tone="red">Blocking</Pill>
                      <div className="grow">
                        <a href={`/i/${r.ref}`} style={{ fontWeight: 500 }}>{r.name}</a>
                        <div className="meta">
                          <Tag color={colors.get(w.waiter_id) ?? "#999"}>{w.waiter}</Tag> is waiting{w.since ? ` since ${fmtDay(w.since)}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="section-head" style={{ justifyContent: "space-between" }}>
                <h2>All initiatives</h2>
                <nav className="chips" aria-label="Filter">
                  {FILTERS.map((f) => (
                    <a key={f.id} className="chip" href={f.id === "all" ? "/" : `/?filter=${f.id}`} aria-current={filter === f.id ? "true" : undefined}>
                      {f.label} <span className="count">{counts[f.id]}</span>
                    </a>
                  ))}
                </nav>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Initiative</th>
                      <th>Holding it now</th>
                      <th>Teams</th>
                      <th>Days open</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.ref}>
                        <td>
                          <a href={`/i/${r.ref}`} style={{ fontWeight: 500 }}>{r.name}</a>
                          <div className="mono muted">{r.ref}</div>
                        </td>
                        <td>
                          {r.holder ? <Tag color={colors.get(r.holder) ?? "#999"}>{r.holder}</Tag> : "–"}
                          {r.waiting.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <Pill tone="amber">{r.waiting[0].waiter} waiting</Pill>
                            </div>
                          )}
                        </td>
                        <td><MiniTrack row={r} /></td>
                        <td className={(r.days_open ?? 0) > TARGET_DAYS ? "tone-red" : ""}>{r.days_open ?? "–"}</td>
                        <td className="muted">{r.target_date ? fmtDay(r.target_date) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="col-side">
            <section className="card">
              <h2>Who's holding what</h2>
              <ul className="list">
                {metrics.holders.map(([u, n]) => (
                  <li key={u} style={{ alignItems: "center" }}>
                    <span style={{ width: 120 }}>{u}</span>
                    <div className="grow bar">
                      <span style={{ width: `${(100 * n) / (metrics.holders[0]?.[1] || 1)}%`, background: colors.get(u) ?? "#999" }} />
                    </div>
                    <span className="mono muted" style={{ width: 24, textAlign: "right" }}>{n}</span>
                  </li>
                ))}
              </ul>
            </section>
            <FeedCard feed={feed} colors={colors} title={`${myUnit.name} feed`} unitHref={`/teams/${me.unit_id}`} ctxUnits={ctx.units} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function FeedCard({
  feed,
  colors,
  title,
  unitHref,
  ctxUnits,
}: {
  feed: Awaited<ReturnType<typeof feedFor>>;
  colors: Map<string, string>;
  title: string;
  unitHref?: string;
  ctxUnits: Map<string, { name: string }>;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {unitHref && <a className="small" href={unitHref} style={{ marginLeft: "auto" }}>See all</a>}
      </div>
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
                {ctxUnits.get(f.detail.from_unit)?.name} · <LevelPill level={f.detail.level as Level} /> · {fmtTime(f.at)}
              </div>
            </div>
          </li>
        ))}
        {feed.length === 0 && <li className="empty">Nothing yet.</li>}
      </ul>
    </section>
  );
}

async function PartnerHome({ me, rows, feed, today }: { me: Awaited<ReturnType<typeof currentPersona>>; rows: Row[]; feed: Awaited<ReturnType<typeof feedFor>>; today: string }) {
  const db = await appDb();
  const units = new Map((await db.query<{ id: string; name: string; color: string }>("select id, name, color from unit")).rows.map((u) => [u.id, u]));
  const colors = new Map([...units.values()].map((u) => [u.id, u.color]));
  return (
    <Shell me={me} current="home">
      <TopBar crumbs={[{ label: "Your launches" }]}>
        <span className="muted small">{today} (demo date)</span>
      </TopBar>
      <div className="page stack">
        <div>
          <h1>Launches with Larkspur</h1>
          <p className="muted">What Larkspur shares with {me.name}: where each launch is and who is working on it.</p>
        </div>
        <div className="cols">
          <div className="col-main">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Launch</th>
                    <th>Holding it now</th>
                    <th>Teams</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.ref}>
                      <td>
                        <a href={`/i/${r.ref}`} style={{ fontWeight: 500 }}>{r.name}</a>
                        <div className="mono muted">{r.ref}</div>
                      </td>
                      <td>{r.holder ?? "–"}</td>
                      <td><MiniTrack row={r} /></td>
                      <td className="muted">{r.target_date ? fmtDay(r.target_date) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-side">
            <FeedCard feed={feed} colors={colors} title="Updates for you" ctxUnits={units} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
