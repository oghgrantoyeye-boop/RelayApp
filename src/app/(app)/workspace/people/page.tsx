import { currentViewer } from "@/lib/session";
import { listInvites } from "@/lib/auth/workspace-setup";
import { invitePersonAction, createTeamAction, setLeadAction } from "@/app/actions/workspace";
import { accountFromSession, SESSION_COOKIE } from "@/lib/auth/accounts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSampleOrg } from "@/lib/auth/workspaces";

export const dynamic = "force-dynamic";

export default async function WorkspacePeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>;
}) {
  const { error, msg } = await searchParams;
  const { db, viewer, orgId } = await currentViewer();
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
      `select a.id, a.name, a.email, a.title from app_user a where a.org_id = $1 and a.kind = 'human' order by a.name`,
      [orgId],
    ),
    db.query(`select id, name, slug from unit where org_id = $1 order by name`, [orgId]),
    listInvites(db, orgId),
  ]);
  const leads = await db.query(
    `select m.unit_id, a.name from member m join app_user a on a.id = m.user_id where m.org_id = $1 and m.role = 'lead'`,
    [orgId],
  );
  const leadName = Object.fromEntries(leads.map((l) => [l.unit_id, l.name]));

  return (
    <main className="page">
      <div className="crumbs">{viewer.user.name} / Workspace</div>
      <h1>People and teams</h1>
      <p className="muted" style={{ fontSize: 14 }}>
        Invite people by email, create teams and pick leads. Sources come next.
      </p>
      {error && (
        <p className="notice err" role="alert">
          {error}
        </p>
      )}
      {msg && <p className="notice">{msg}</p>}

      <div className="grid two" style={{ marginTop: 18, gap: 18 }}>
        <section className="card">
          <h2>Invite people</h2>
          <form action={invitePersonAction} className="stack" style={{ gap: 10, marginTop: 10 }}>
            <input type="hidden" name="orgId" value={orgId} />
            <label>
              Email
              <input type="email" name="email" required placeholder="teammate@company.com" />
            </label>
            <label>
              Team
              <select name="unitId" defaultValue="">
                <option value="">Any / first team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="b">
              Invite
            </button>
          </form>
          {invites.length > 0 && (
            <ul className="list" style={{ marginTop: 14 }}>
              {invites.map((i) => (
                <li key={i.id}>
                  <strong>{i.email}</strong> · {i.status}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Create a team</h2>
          <form action={createTeamAction} className="stack" style={{ gap: 10, marginTop: 10 }}>
            <input type="hidden" name="orgId" value={orgId} />
            <label>
              Name
              <input name="name" required placeholder="Payments API" />
            </label>
            <label>
              Lead
              <select name="leadUserId" defaultValue="">
                <option value="">Pick later</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="b">
              Create team
            </button>
          </form>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Teams</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Lead</th>
              <th>Set lead</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{leadName[t.id] ?? "—"}</td>
                <td>
                  <form action={setLeadAction} style={{ display: "flex", gap: 8 }}>
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="unitId" value={t.id} />
                    <select name="leadUserId" defaultValue="" required>
                      <option value="" disabled>
                        Choose
                      </option>
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
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>People</h2>
        <p className="muted">
          {people.length} members · {teams.length} teams
        </p>
        <ul className="list">
          {people.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              {p.email ? ` · ${p.email}` : ""}
              {p.title ? ` · ${p.title}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
