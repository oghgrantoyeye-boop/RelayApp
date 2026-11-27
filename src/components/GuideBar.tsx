// A bar above every page while someone walks through the demo guide: the step they're on, what to
// do, and a button for the next step. The guide's buttons set the step; Hide or a reset clears it.
import Link from "next/link";
import type { DemoPack } from "@/lib/demos";
import { hideGuideBar, setPersona } from "@/app/actions";
import { PathInput } from "@/components/Nav";

export function GuideBar({ demo, step, firstName }: { demo: DemoPack; step: number; firstName: Record<string, string> }) {
  const s = demo.guide[step];
  if (!s) return null;
  const next = demo.guide[step + 1];
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#18181b", color: "#fff", padding: "10px 20px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 420px", minWidth: 0 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Demo guide · step {step + 1} of {demo.guide.length} · you&apos;re {firstName[s.as] ?? s.as}</div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{s.title}</div>
        <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>{s.text}</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
        <Link href="/guide" className="b sm" style={{ background: "transparent", color: "#fff", borderColor: "#52525b" }}>All steps</Link>
        {next ? (
          <form action={setPersona}>
            <input type="hidden" name="userId" value={next.as} />
            <input type="hidden" name="path" value={next.href} />
            <input type="hidden" name="step" value={String(step + 1)} />
            <button className="b sm" type="submit">Next: {next.title} →</button>
          </form>
        ) : (
          <form action={hideGuideBar}>
            <input type="hidden" name="path" value="/guide" />
            <button className="b sm" type="submit">Finish</button>
          </form>
        )}
        <form action={hideGuideBar}>
          <PathInput />
          <button className="b sm" type="submit" style={{ background: "transparent", color: "#a1a1aa", borderColor: "transparent" }} aria-label="Hide the guide bar">Hide</button>
        </form>
      </div>
    </div>
  );
}
