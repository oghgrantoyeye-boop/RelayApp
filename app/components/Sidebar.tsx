import { Suspense } from "react";
import { appDb } from "@/lib/app-db";
import type { Member } from "@/lib/permissions";
import { PersonaSwitch } from "./PersonaSwitch";
import { Avatar, Icon } from "./ui";

export async function Sidebar({ me, current }: { me: Member; current: string }) {
  const db = await appDb();
  const units = (await db.query<{ id: string; name: string; kind: string; color: string }>("select id, name, kind, color from unit order by kind, name")).rows;
  const members = (await db.query<{ id: string; unit_id: string; name: string; role: string }>("select id, unit_id, name, role from member where kind = 'person' order by name")).rows;
  const org = (await db.query<{ name: string }>("select name from org limit 1")).rows[0]?.name ?? "Relay";
  const myUnit = units.find((u) => u.id === me.unit_id)!;
  const isPublic = myUnit.kind === "public";
  const groups = units.map((u) => ({ unit: u.name, members: members.filter((m) => m.unit_id === u.id) }));
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="org">
        <span className="org-mark">{org[0]}</span>
        <span className="org-name">{org}</span>
      </div>
      <a href="/" aria-current={current === "home" ? "page" : undefined}>
        <Icon name="home" />
        {isPublic ? "Your launches" : "Waiting on"}
      </a>
      {!isPublic && (
        <a href={`/teams/${me.unit_id}`} aria-current={current === me.unit_id ? "page" : undefined}>
          <Icon name="iface" />
          Your team
        </a>
      )}
      {!isPublic && (
        <>
          <div className="nav-heading">Teams</div>
          {units
            .filter((u) => u.kind === "internal")
            .map((u) => (
              <a key={u.id} href={`/teams/${u.id}`} aria-current={current === u.id ? "page" : undefined}>
                <span className="swatch nav-swatch" style={{ background: u.color }} />
                {u.name}
              </a>
            ))}
        </>
      )}
      <div className="sidebar-foot">
        <div className="me">
          <Avatar name={me.name} size={26} />
          <div>
            <div className="me-name">{me.name}</div>
            <div className="muted small">
              {me.role} · {myUnit.name}
            </div>
          </div>
        </div>
        <Suspense>
          <PersonaSwitch current={me.id} groups={groups} />
        </Suspense>
      </div>
    </nav>
  );
}
