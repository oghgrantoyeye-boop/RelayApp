import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { loadViewer } from "@/lib/data";
import { Avatar, Flash, Topbar } from "@/components/ui";
import { setPersona } from "@/app/actions";
import type { GuideStep } from "@/lib/demos/types";

function OpenAs({ as, href, label, primary, step }: { as: string; href: string; label: string; primary?: boolean; step?: number | "off" }) {
  return (
    <form action={setPersona}>
      <input type="hidden" name="userId" value={as} />
      <input type="hidden" name="path" value={href} />
      {step !== undefined && <input type="hidden" name="step" value={String(step)} />}
      <button className={`b sm${primary ? " bp" : ""}`} type="submit">{label}</button>
    </form>
  );
}

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const people = new Map<string, { name: string; first: string; title: string; team: string }>();
  const ids = [...demo.intro.cast.map((c) => c.as), ...demo.guide.flatMap((s) => [s.as, s.compare ?? s.as]), ...demo.explore.map((s) => s.as)];
  for (const id of ids) {
    if (people.has(id)) continue;
    const v = await loadViewer(db, id);
    if (v) people.set(id, { name: v.user.name, first: v.user.name.split(" ")[0], title: v.user.title, team: v.team.name });
  }
  const first = (id: string) => people.get(id)?.first ?? id;
  const stepRow = (step: GuideStep, i: number | null) => (
    <li key={`${step.title}-${i}`} style={{ alignItems: "flex-start", gap: 14 }}>
      {i !== null && (
        <span style={{ flex: "none", width: 28, height: 28, borderRadius: 999, background: "var(--ink)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
          {i + 1}
        </span>
      )}
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{step.title}</div>
        <div style={{ marginTop: 4 }}>{step.text}</div>
        {step.why && (
          <div className="small" style={{ marginTop: 6, color: "var(--muted)" }}>
            <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Why it matters: </strong>{step.why}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flex: "none" }}>
        <Avatar name={people.get(step.as)?.name ?? step.as} size={32} />
        <OpenAs as={step.as} href={step.href} label={`Open as ${first(step.as)}`} primary={i !== null} step={i ?? "off"} />
        {step.compare && <OpenAs as={step.compare} href={step.href} label={`Open as ${first(step.compare)}`} step={i ?? "off"} />}
      </div>
    </li>
  );

  return (
    <>
      <Topbar crumbs={[demo.org.name, "Demo guide"]}>
        <Link href="/demos" className="b">Choose another demo</Link>
      </Topbar>
      <div className="content" style={{ maxWidth: 820 }}>
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <div className="small muted">{demo.audience} · {demo.org.headcount.toLocaleString("en-US")} people · Dec 6, 2026</div>
            <h1>{demo.org.name}</h1>
          </div>
        </div>

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>The story</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{demo.intro.problem}</p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Who you&apos;ll be</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {demo.intro.cast.map((c) => {
              const p = people.get(c.as);
              return (
                <div key={c.as} className="card" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Avatar name={p?.name ?? c.as} size={44} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{p?.name}</div>
                    <div className="small muted">{p?.title}, {p?.team}</div>
                    <div className="small" style={{ marginTop: 4 }}>{c.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 4 }}>{demo.guide.length} steps, about five minutes</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>
            Do them in order. Each button switches you to the right person and opens the right page. You&apos;re viewing as {viewer.user.name}.
          </p>
          <ol className="list card tight" style={{ listStyle: "none", margin: 0 }}>{demo.guide.map((s, i) => stepRow(s, i))}</ol>
        </section>

        {demo.explore.length > 0 && (
          <section>
            <h2 style={{ marginBottom: 4 }}>More to explore</h2>
            <p className="small muted" style={{ marginBottom: 10 }}>Optional, in any order.</p>
            <ul className="list card tight" style={{ listStyle: "none", margin: 0 }}>{demo.explore.map((s) => stepRow(s, null))}</ul>
          </section>
        )}
        <p className="small muted" style={{ marginTop: 16 }}>To start over, use Reset demo data at the bottom of the sidebar.</p>
      </div>
    </>
  );
}
