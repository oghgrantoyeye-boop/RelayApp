import Link from "next/link";
import { currentViewer } from "@/lib/session";
import { listInvites } from "@/lib/auth/workspace-setup";
import { invitePersonAction, createTeamAction, setLeadAction } from "@/app/actions/workspace";
import { accountFromSession, SESSION_COOKIE } from "@/lib/auth/accounts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSampleOrg } from "@/lib/auth/workspaces";
import { Avatar, Flash, Topbar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkspacePeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>;
}) {
  const { error, msg } = await searchParams;
  const { db, orgId, demo } = await currentViewer();
  const account = await accountFromSession(db, (await cookies()).get(SESSION_COOKIE)?.value);
  if (!account) redirect("/signin");
  const org = await db.one(`select * from org where id = $1`, [orgId]);
  if (isSampleOrg(org?.settings)) redirect("/guide");

  const membership = await db.one(`select * from org_membership where account_id = $1 and org_id = $2`, [
    account.id,
    orgId,
  ]);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    redirect("/directory");
  }

  const [people, teams, invites] = await Promise.all([
    db.query(
      `select a.id, a.name, a.email, a.title, om.role as org_role
       from app_user a
       join org_membership om on om.user_id = a.id and om.org_id = a.org_id
       where a.org_id = $1 and a.kind = 'human'
       order by a.name`,
      [orgId],
    ),
    db.query(`select id, name, slug from unit where org_id = $1 order by name`, [orgId]),
    listInvites(db, orgId),
  ]);
  const leads = await db.query(
    `select m.unit_id, a.id as user_id, a.name
     from member m
     join app_user a on a.id = m.user_id
     where m.org_id = $1 and m.role = 'lead'`,
    [orgId],
  );
  const leadByUnit = Object.fromEntries(
    leads.map((l) => [l.unit_id, { id: l.user_id as string, name: l.name as string }]),
  );
  const teamName = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const pending = invites.filter((i) => i.status === "pending");
  const flash = error ? `Error: ${error}` : msg;

  return (
    <>
      <Topbar crumbs={[demo.org.name, "People"]} />
      <div className="content">
        <Flash msg={flash} />
        <div className="page-head">
          <div>
            <h1>People and teams</h1>
            <p>Invite people by email, create teams, and pick who leads each one.</p>
          </div>
        </div>

        <div className="two" style={{ marginBottom: 28 }}>
          <section className="primary">
            <div>
              <h2>
                Teams ({teams.length})
              </h2>
              {teams.length === 0 ? (
                <div className="card empty">No teams yet. Create one on the right.</div>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Lead</th>
                        <th>Change lead</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((t) => {
                        const lead = leadByUnit[t.id];
                        return (
                          <tr key={t.id}>
                            <td>
                              <Link href={`/teams/${t.slug}`} style={{ fontWeight: 500 }}>
                                {t.name}
                              </Link>
                            </td>
                            <td>{lead?.name ?? <span className="muted">No lead</span>}</td>
                            <td>
                              <form action={setLeadAction} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                                <input type="hidden" name="orgId" value={orgId} />
                                <input type="hidden" name="unitId" value={t.id} />
                                <select
                                  name="leadUserId"
                                  defaultValue={lead?.id ?? ""}
                                  required
                                  aria-label={`Lead for ${t.name}`}
                                  style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 220 }}
                                >
                                  {!lead && (
                                    <option value="" disabled>
                                      Choose someone
                                    </option>
                                  )}
                                  {people.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                                <button type="submit" className="b sm">
                                  Save
                                </button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h2>
                People ({people.length})
              </h2>
              <p className="small muted" style={{ margin: "-4px 0 8px" }}>
                {people.length} {people.length === 1 ? "member" : "members"} · {teams.length}{" "}
                {teams.length === 1 ? "team" : "teams"}
              </p>
              {people.length === 0 ? (
                <div className="card empty">No people in this workspace yet.</div>
              ) : (
                <ul className="list card tight">
                  {people.map((p) => {
                    const role =
                      p.title ||
                      (p.org_role === "owner" ? "Owner" : p.org_role === "admin" ? "Admin" : "Member");
                    return (
                      <li key={p.id}>
                        <Avatar name={p.name} />
                        <div className="grow">
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          <div className="small muted">{[p.email, role].filter(Boolean).join(" · ")}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <aside>
            <section className="card">
              <h2>Invite people</h2>
              <p className="small muted">They join after signing in with this email.</p>
              <form action={invitePersonAction} className="stack" style={{ gap: 10, marginTop: 12 }}>
                <input type="hidden" name="orgId" value={orgId} />
                <label className="field">
                  <span>Email</span>
                  <input type="email" name="email" required placeholder="teammate@company.com" autoComplete="email" />
                </label>
                <label className="field">
                  <span>Team</span>
                  <select name="unitId" defaultValue="">
                    <option value="">First available team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="b bp" style={{ alignSelf: "flex-start" }}>
                  Invite
                </button>
              </form>
              {pending.length > 0 && (
                <ul className="list" style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  {pending.map((i) => (
                    <li key={i.id} style={{ padding: "8px 0" }}>
                      <div className="grow">
                        <div style={{ fontWeight: 500 }}>{i.email}</div>
                        <div className="small muted">
                          Pending · {i.unit_id ? teamName[i.unit_id] ?? "team" : "first available team"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Create a team</h2>
              <p className="small muted">Each team gets an agent that answers from what it knows.</p>
              <form action={createTeamAction} className="stack" style={{ gap: 10, marginTop: 12 }}>
                <input type="hidden" name="orgId" value={orgId} />
                <label className="field">
                  <span>Name</span>
                  <input type="text" name="name" required placeholder="Team name" autoComplete="off" />
                </label>
                <label className="field">
                  <span>Lead</span>
                  <select name="leadUserId" defaultValue="">
                    <option value="">Pick later</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="b bp" style={{ alignSelf: "flex-start" }}>
                  Create team
                </button>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
