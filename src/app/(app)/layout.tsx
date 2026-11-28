import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "../globals.css";
import { cookies } from "next/headers";
import { currentViewer, GUIDE_COOKIE } from "@/lib/session";
import { GuideBar } from "@/components/GuideBar";
import { Dock } from "@/components/chat/Dock";
import { Suspense } from "react";
import { NavLink, PathInput, PersonaSwitcher } from "@/components/Nav";
import { Avatar, Icon } from "@/components/ui";
import { BeaconMark } from "@/components/site/Brand";
import { resetDemo, setPersona } from "@/app/actions";
import { workersEnabled } from "@/lib/flags";
import { needsHostedDbWarning } from "@/lib/db";


export const metadata: Metadata = {
  title: "Beacon demo",
  description: "Beacon's working prototype, with a fictional company. Ask any team, get answers with sources, and the rest goes to the right person.",
  icons: { icon: "/icon.svg" },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { db, viewer, demo, isSample } = await currentViewer();
  const [asks, inbox, drafts, people] = await Promise.all([
    db.one(`select count(*)::int as n from request r left join member m on m.id = r.assignee_member_id where r.status = 'open' and (m.user_id = $1 or (r.destination = 'team_queue' and r.to_unit_id = any($2)))`, [viewer.user.id, viewer.reader.unitIds]),
    db.one(`select count(*)::int as n from delivery where recipient_id = $1 and read_at is null`, [viewer.user.id]),
    db.one(`select count(*)::int as n from team_update where author_id = $1 and status = 'draft'`, [viewer.user.id]),
    db.query(
      `select a.id, a.name, a.title, u.name as team, u.parent_unit_id from app_user a join member m on m.user_id = a.id join unit u on u.id = m.unit_id
       where a.org_id = $1 and a.kind = 'human' and m.role <> 'agent' order by (u.parent_unit_id is null) desc, u.name, (m.role = 'lead') desc, a.name`,
      [viewer.orgId],
    ),
  ]);
  const groups: { team: string; people: { id: string; name: string; title: string }[] }[] = [];
  const seen = new Set<string>();
  for (const p of people) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    let g = groups.find((x) => x.team === p.team);
    if (!g) groups.push((g = { team: p.team, people: [] }));
    g.people.push({ id: p.id, name: p.name, title: p.title });
  }
  const isLeadership = viewer.reader.unitIds.includes("leadership");
  const guideStep = Number((await cookies()).get(GUIDE_COOKIE)?.value ?? NaN);
  const firstName = Object.fromEntries(people.map((p) => [p.id, String(p.name).split(" ")[0]]));
  const fullName = Object.fromEntries(people.map((p) => [p.id, String(p.name)]));

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <div className="shell">
          <nav className="nv" aria-label="Main">
            <a href="/" className="brand" title="Beacon home" style={{ color: "var(--ink)" }}>
              <BeaconMark size={22} />
              <span>beacon</span>
              <span className="muted small" style={{ fontWeight: 400 }}>{demo.org.name} demo</span>
            </a>
            <form action="/directory" className="search" role="search">
              <Icon name="search" size={14} />
              <input type="search" name="q" placeholder="Search teams, people, what they own" aria-label="Search the directory" />
            </form>
            <NavLink href="/guide"><Icon name="spark" />Demo guide</NavLink>
            {workersEnabled() && <a href="/agents/new" className="b bp sm nv-new"><Icon name="agent" />New teammate</a>}
            <NavLink href="/messages"><Icon name="chat" />Ask Beacon</NavLink>
            <NavLink href="/directory"><Icon name="directory" />Teams</NavLink>
            <NavLink href="/asks">
              <Icon name="asks" />Asks for you{asks!.n > 0 && <span className="count hot">{asks!.n}</span>}
            </NavLink>
            <NavLink href="/feed"><Icon name="feed" />What&apos;s changing</NavLink>
            <NavLink href="/write">
              <Icon name="write" />Write update{drafts!.n > 0 && <span className="count">{drafts!.n} draft{drafts!.n > 1 ? "s" : ""}</span>}
            </NavLink>
            <NavLink href="/inbox">
              <Icon name="inbox" />Inbox{inbox!.n > 0 && <span className="count">{inbox!.n}</span>}
            </NavLink>
            <NavLink href="/audit"><Icon name="audit" />Audit log</NavLink>
            <NavLink href="/connect"><Icon name="connect" />Integrations</NavLink>
            {!isSample && <NavLink href="/workspace/people"><Icon name="directory" />People</NavLink>}
            {workersEnabled() && (
              <>
                <div className="section">Deferred</div>
                <NavLink href="/agents"><Icon name="agent" />Agents</NavLink>
                <NavLink href="/commitments"><Icon name="commitments" />Commitments</NavLink>
                <NavLink href="/meetings"><Icon name="meetings" />Meetings</NavLink>
                <NavLink href="/map"><Icon name="map" />Team map</NavLink>
                <NavLink href="/digest"><Icon name="digest" />Leadership digest{!isLeadership && <span className="count">view</span>}</NavLink>
              </>
            )}
            <div className="section">Your teams</div>
            {viewer.units.map((u) => (
              <NavLink key={u.id} href={`/teams/${u.slug}`}>
                <span className="swatch" style={{ background: u.color, margin: "0 3px" }} />
                {u.name}
                {u.role === "lead" && <span className="count">lead</span>}
              </NavLink>
            ))}
            <div className="persona">
              <div className="row" style={{ gap: 9 }}>
                <Avatar name={viewer.user.name} size={30} />
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, minWidth: 0 }}>
                  <span style={{ fontWeight: 500 }}>{viewer.user.name}</span>
                  <span className="small muted">{viewer.user.title}, {viewer.team.name}</span>
                </div>
              </div>
              {isSample && <PersonaSwitcher current={viewer.user.id} groups={groups} action={setPersona} />}
              {isSample && (
                <form action={resetDemo}>
                  <PathInput />
                  <button className="b sm" type="submit" style={{ width: "100%", justifyContent: "center" }}>Reset demo data</button>
                </form>
              )}
              <a href="/signin" className="b sm" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
                {isSample ? "Workspaces" : "Switch workspace"}
              </a>
              {isSample && <a href="/demos" className="b sm" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>Choose a demo</a>}
            </div>
          </nav>
          <main className="main">
            {needsHostedDbWarning() && (
              <div className="notice err" role="status" style={{ margin: "12px 16px 0" }}>
                This Vercel deploy has no <code>DATABASE_URL</code>. Data is in memory and resets when the server restarts. Attach a Neon or other Postgres URL in the Vercel project so preview and production keep their data.
              </div>
            )}
            {Number.isInteger(guideStep) && <GuideBar demo={demo} step={guideStep} firstName={firstName} fullName={fullName} />}
            {children}
          </main>
          <Suspense fallback={null}><Dock db={db} viewer={viewer} demo={demo} /></Suspense>
        </div>
      </body>
    </html>
  );
}
