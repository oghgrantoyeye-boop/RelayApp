import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { loadViewer } from "@/lib/data";
import { Flash, Topbar } from "@/components/ui";
import { setPersona } from "@/app/actions";

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db, viewer, demo } = await currentViewer();
  const people = new Map<string, string>();
  for (const step of demo.guide) {
    if (!people.has(step.as)) {
      const v = await loadViewer(db, step.as);
      people.set(step.as, v ? `${v.user.name}, ${v.team.name}` : step.as);
    }
  }
  return (
    <>
      <Topbar crumbs={[demo.org.name, "Demo guide"]}>
        <Link href="/demos" className="b">Choose another demo</Link>
      </Topbar>
      <div className="content">
        <Flash msg={msg} />
        <div className="page-head">
          <div>
            <h1>{demo.org.name}</h1>
            <p>{demo.audience}. {demo.summary}</p>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 14 }}>
          The story is set on Dec 6, 2026. Each step opens the right page as the right person. You&apos;re viewing as {viewer.user.name}. Run the steps in order: step 4 changes what step 6 shows.
        </p>
        <ol className="list card tight" style={{ listStyle: "none", margin: 0 }}>
          {demo.guide.map((step, i) => (
            <li key={i} style={{ alignItems: "flex-start" }}>
              <span className="lead-col" style={{ fontWeight: 600, fontSize: 18, color: "var(--muted)" }}>{i + 1}</span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{step.title}</div>
                <div className="muted" style={{ marginTop: 4 }}>{step.text}</div>
                <div className="small muted" style={{ marginTop: 4 }}>As {people.get(step.as)}</div>
              </div>
              <form action={setPersona}>
                <input type="hidden" name="userId" value={step.as} />
                <input type="hidden" name="path" value={step.href} />
                <button className="b sm" type="submit">Open</button>
              </form>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
