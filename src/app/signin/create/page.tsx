import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { accountFromSession, SESSION_COOKIE } from "@/lib/auth/accounts";
import { createWorkspaceAction } from "@/app/actions/workspace";
import { BeaconMark } from "@/components/site/Brand";

export const dynamic = "force-dynamic";

export default async function CreateWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const db = await getDb();
  const account = await accountFromSession(db, (await cookies()).get(SESSION_COOKIE)?.value);
  if (!account) redirect("/signin");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "48px 16px", background: "#fafafa", color: "#18181b" }}>
      <div style={{ width: "min(440px, 100%)", border: "1px solid #e6e6ea", borderRadius: 10, padding: 26, background: "#fff" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <BeaconMark size={22} />
          <strong style={{ fontSize: 15 }}>Beacon</strong>
        </div>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Create a workspace</h1>
        <p style={{ color: "#5f5f6b", margin: "0 0 16px" }}>
          Invite your teams and connect sources. Beacon starts learning right away.
        </p>
        {error && (
          <p role="alert" style={{ background: "#fef3f2", color: "#b42318", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
            {error}
          </p>
        )}
        <form action={createWorkspaceAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#5f5f6b" }}>
            Workspace name
            <input
              name="name"
              required
              minLength={2}
              placeholder="Northwind Labs"
              style={{ display: "block", width: "100%", marginTop: 4, fontSize: 16, padding: "9px 11px", borderRadius: 8, border: "1px solid #e6e6ea" }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#5f5f6b" }}>
            First team (optional)
            <input
              name="firstTeam"
              placeholder="Platform"
              style={{ display: "block", width: "100%", marginTop: 4, fontSize: 16, padding: "9px 11px", borderRadius: 8, border: "1px solid #e6e6ea" }}
            />
          </label>
          <button
            type="submit"
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #18181b",
              background: "#18181b",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create workspace
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link href="/signin">Back to workspaces</Link>
        </p>
      </div>
    </main>
  );
}
