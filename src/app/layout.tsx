import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { currentViewer } from "@/lib/session";
import { NavLink, PathInput, PersonaSwitcher } from "@/components/Nav";
import { Icon, initials } from "@/components/ui";
import { resetDemo, setPersona } from "./actions";

export const metadata: Metadata = {
  title: "Relay",
  description: "Every team has a page. Its updates, asks and commitments reach the right teams automatically.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { db, viewer } = await currentViewer();
  const [asks, inbox, drafts, people] = await Promise.all([
    db.one(`select count(*)::int as n from request r join member m on m.id = r.assignee_member_id where m.user_id = $1 and r.status = 'open'`, [viewer.user.id]),
    db.one(`select count(*)::int as n from delivery where recipient_id = $1 and read_at is null`, [viewer.user.id]),
    db.one(`select count(*)::int as n from team_update where author_id = $1 and status = 'draft'`, [viewer.user.id]),
    db.query(
      `select a.id, a.name, a.title, u.name as team, u.parent_unit_id from app_user a join member m on m.user_id = a.id join unit u on u.id = m.unit_id
       where a.kind = 'human' and m.role <> 'agent' order by (u.parent_unit_id is null) desc, u.name, (m.role = 'lead') desc, a.name`,
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

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <div className="shell">
          <nav className="nv" aria-label="Main">
            <div className="brand">
              <span className="logo">R</span>
              <span>Relay</span>
              <span className="muted small" style={{ fontWeight: 400 }}>Northwind Labs</span>
            </div>
            <form action="/directory" className="search" role="search">
              <Icon name="search" size={14} />
              <input type="search" name="q" placeholder="Search teams, people, what they own" aria-label="Search the directory" />
            </form>
            <NavLink href="/feed"><Icon name="feed" />My feed</NavLink>
            <NavLink href="/asks">
              <Icon name="asks" />Asks for you{asks!.n > 0 && <span className="count hot">{asks!.n}</span>}
            </NavLink>
            <NavLink href="/commitments"><Icon name="commitments" />Commitments</NavLink>
            <NavLink href="/write">
              <Icon name="write" />Write update{drafts!.n > 0 && <span className="count">{drafts!.n} draft{drafts!.n > 1 ? "s" : ""}</span>}
            </NavLink>
            <NavLink href="/directory"><Icon name="directory" />Directory</NavLink>
            <NavLink href="/digest"><Icon name="digest" />Leadership digest{!isLeadership && <span className="count">view</span>}</NavLink>
            <NavLink href="/inbox">
              <Icon name="inbox" />Inbox{inbox!.n > 0 && <span className="count">{inbox!.n}</span>}
            </NavLink>
            <NavLink href="/audit"><Icon name="audit" />Audit log</NavLink>
            <NavLink href="/connect"><Icon name="connect" />Connect tools</NavLink>
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
                <span className="av" style={{ width: 26, height: 26 }}>{initials(viewer.user.name)}</span>
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, minWidth: 0 }}>
                  <span style={{ fontWeight: 500 }}>{viewer.user.name}</span>
                  <span className="small muted">{viewer.user.title}, {viewer.team.name}</span>
                </div>
              </div>
              <PersonaSwitcher current={viewer.user.id} groups={groups} action={setPersona} />
              <form action={resetDemo}>
                <PathInput />
                <button className="b sm" type="submit" style={{ width: "100%", justifyContent: "center" }}>Reset demo data</button>
              </form>
            </div>
          </nav>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
