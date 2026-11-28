import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { orgChart, search } from "@/lib/directory";
import { Avatar, TeamChip, Topbar } from "@/components/ui";
import type { Row } from "@/lib/db";

function Tree({ nodes }: { nodes: (Row & { children: Row[] })[] }) {
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link href={`/teams/${n.slug}`} className="row" style={{ gap: 6, display: "inline-flex" }}>
            <span className="swatch" style={{ background: n.color }} />
            <span style={{ fontWeight: 500 }}>{n.name}</span>
          </Link>
          <span className="small muted"> · {n.lead_name ?? "no lead"} · {n.people} {n.people === 1 ? "person" : "people"}</span>
          {n.children.length > 0 && <Tree nodes={n.children as never} />}
        </li>
      ))}
    </ul>
  );
}

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { db, demo, viewer } = await currentViewer();
  const results = q ? await search(db, q, viewer.orgId) : null;
  const chart = await orgChart(db, viewer.orgId);
  return (
    <>
      <Topbar crumbs={[demo.org.name, "Directory"]} />
      <div className="content">
        <div className="page-head">
          <div>
            <h1>Directory</h1>
            <p>Who does what at {demo.org.name}: teams, what they own, and how to work with them.</p>
          </div>
        </div>
        <form className="row" style={{ marginBottom: 20 }} role="search">
          <input type="search" name="q" defaultValue={q} placeholder={demo.ui.searchHint} aria-label="Search" style={{ maxWidth: 420 }} />
          <button className="b bp" type="submit">Search</button>
        </form>
        {results && (
          <section style={{ marginBottom: 28 }}>
            <h2>Results for &ldquo;{q}&rdquo;</h2>
            {results.teams.length === 0 && results.people.length === 0 && <div className="card empty">No team or person matches. Try what they own, like &ldquo;pricing&rdquo;.</div>}
            {results.teams.length > 0 && (
              <ul className="list card tight" style={{ marginBottom: 12 }}>
                {results.teams.slice(0, 6).map((r) => (
                  <li key={r.team.id}>
                    <div className="grow">
                      <Link href={`/teams/${r.team.slug}`} style={{ fontWeight: 600 }}>{r.team.name}</Link>
                      <div className="small muted">{r.why}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {results.people.length > 0 && (
              <ul className="list card tight">
                {results.people.map((p) => (
                  <li key={p.id + p.unit_slug}>
                    <Avatar name={p.name} />
                    <div className="grow"><div style={{ fontWeight: 500 }}>{p.name}</div><div className="small muted">{p.title}</div></div>
                    <TeamChip team={{ name: p.unit_name, slug: p.unit_slug }} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section>
          <h2>Org chart</h2>
          <div className="card tree"><Tree nodes={chart} /></div>
        </section>
      </div>
    </>
  );
}
