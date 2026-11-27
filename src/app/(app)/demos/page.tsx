import { currentViewer } from "@/lib/session";
import { DEMOS } from "@/lib/demos";
import { Flash, Pill, Topbar } from "@/components/ui";
import { switchDemo } from "@/app/actions";

export default async function DemosPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { demo } = await currentViewer();
  return (
    <>
      <Topbar crumbs={["Choose a demo"]} />
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>Choose a demo</h1>
            <p>Each demo is a fictional organization running Beacon, with its own teams, people, tools and a story set on Dec 6. Loading one resets the demo data.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {DEMOS.map((d) => {
            const teams = d.teams.filter((t) => !t.group);
            return (
              <div key={d.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
                  <span className="small muted">{d.audience}</span>
                  {d.id === demo.id && <Pill tone="green">Loaded</Pill>}
                </div>
                <h2 style={{ margin: 0 }}>{d.org.name}</h2>
                <p className="muted" style={{ margin: 0 }}>{d.summary}</p>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {teams.map((t) => (
                    <span key={t.id} className="small" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span className="swatch" style={{ background: t.color }} />{t.name}
                    </span>
                  ))}
                </div>
                <div className="small muted">{d.org.headcount.toLocaleString("en-US")} people · {teams.length} teams · {d.people.length} people to view as</div>
                <form action={switchDemo} style={{ marginTop: "auto" }}>
                  <input type="hidden" name="demo" value={d.id} />
                  <button className={`b${d.id === demo.id ? "" : " bp"}`} type="submit">{d.id === demo.id ? "Reload this demo" : "Load this demo"}</button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
