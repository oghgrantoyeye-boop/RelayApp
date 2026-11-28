import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { accountFromSession, SESSION_COOKIE } from "@/lib/auth/accounts";
import { isAdminEmail, listLeads } from "@/lib/auth/early-access";
import { approveLead, declineLead } from "@/app/actions/early-access";
import { BeaconMark } from "@/components/site/Brand";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EarlyAccessAdminPage() {
  const db = await getDb();
  const jar = await cookies();
  const account = await accountFromSession(db, jar.get(SESSION_COOKIE)?.value);
  if (!account || !isAdminEmail(account.email)) notFound();

  const leads = await listLeads(db);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
        <BeaconMark size={22} />
        <strong>Beacon</strong>
        <span style={{ color: "#5f5f6b", fontSize: 13 }}>· Early access</span>
        <span style={{ flex: 1 }} />
        <Link href="/signin" style={{ fontSize: 13, color: "#5f5f6b" }}>
          Sign in
        </Link>
      </div>
      <h1 style={{ fontSize: 24, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Early access leads</h1>
      <p style={{ color: "#5f5f6b", margin: "0 0 20px" }}>
        Signed in as {account.email}. Approve someone so their next Google, Microsoft or magic-link sign-in creates an account.
      </p>
      {leads.length === 0 ? (
        <p style={{ color: "#5f5f6b" }}>No leads yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid #e6e6ea", borderRadius: 10, background: "#fff" }}>
          {leads.map((lead) => (
            <li
              key={lead.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: "1px solid #e6e6ea",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{lead.email}</div>
                <div style={{ fontSize: 13, color: "#5f5f6b" }}>
                  {[lead.name, lead.company, lead.source, lead.status].filter(Boolean).join(" · ")}
                  {lead.created_at ? ` · ${new Date(lead.created_at).toLocaleString()}` : ""}
                </div>
              </div>
              {lead.status === "pending" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <form action={approveLead}>
                    <input type="hidden" name="id" value={lead.id} />
                    <button type="submit" style={btnPrimary}>
                      Approve
                    </button>
                  </form>
                  <form action={declineLead}>
                    <input type="hidden" name="id" value={lead.id} />
                    <button type="submit" style={btnGhost}>
                      Decline
                    </button>
                  </form>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: lead.status === "approved" ? "#15803d" : "#5f5f6b", textTransform: "capitalize" }}>
                  {lead.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const btnPrimary: CSSProperties = {
  fontSize: 13,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid #18181b",
  background: "#18181b",
  color: "#fff",
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  fontSize: 13,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid #e6e6ea",
  background: "#fff",
  color: "#18181b",
  cursor: "pointer",
};
