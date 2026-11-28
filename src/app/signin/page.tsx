import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { accountFromSession, SESSION_COOKIE } from "@/lib/auth/accounts";
import { authProviders } from "@/lib/auth/config";
import { listWorkspaceChoices } from "@/lib/auth/workspaces";
import { openMemberWorkspace, openSampleWorkspace, requestEmailSignIn, signOut } from "@/app/actions/auth";
import { BeaconMark } from "@/components/site/Brand";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; dev?: string }>;
}) {
  const { error, sent, dev } = await searchParams;
  const db = await getDb();
  const jar = await cookies();
  const account = await accountFromSession(db, jar.get(SESSION_COOKIE)?.value);
  const { mine, samples } = await listWorkspaceChoices(db, account?.id);
  const providers = authProviders();

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", background: "#fafafa", color: "#18181b" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "48px 16px" }}>
          <div style={{ width: "min(440px, 100%)", border: "1px solid #e6e6ea", borderRadius: 10, padding: "26px", background: "#fff" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <BeaconMark size={22} />
              <strong style={{ fontSize: 15 }}>Beacon</strong>
            </div>
            <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Choose a workspace</h1>
            {account ? (
              <p style={{ color: "#5f5f6b", margin: "0 0 12px" }}>Signed in as {account.email}</p>
            ) : (
              <p style={{ color: "#5f5f6b", margin: "0 0 12px" }}>Sign in to your workspaces, or open a sample to explore.</p>
            )}

            {error && (
              <p role="alert" style={{ background: "#fef3f2", color: "#b42318", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                {error}
              </p>
            )}
            {sent && (
              <p style={{ background: "#ecfdf3", color: "#15803d", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                Check {sent} for a sign-in link{dev ? " (dev link below)" : ""}.
              </p>
            )}
            {dev && (
              <p style={{ fontSize: 12, wordBreak: "break-all" }}>
                <a href={dev}>Open magic link</a>
              </p>
            )}

            {!account && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
                {providers.google ? (
                  <a href="/api/auth/google" style={btnStyle}>Continue with Google</a>
                ) : (
                  <p style={{ fontSize: 12, color: "#5f5f6b", margin: 0 }}>Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.</p>
                )}
                {providers.microsoft ? (
                  <a href="/api/auth/microsoft" style={btnStyle}>Continue with Microsoft</a>
                ) : (
                  <p style={{ fontSize: 12, color: "#5f5f6b", margin: 0 }}>Microsoft sign-in needs MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.</p>
                )}
                <form action={requestEmailSignIn} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <label style={{ fontSize: 12, color: "#5f5f6b" }}>
                    Email magic link
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="you@company.com"
                      style={{ display: "block", width: "100%", marginTop: 4, fontSize: 16, padding: "9px 11px", borderRadius: 8, border: "1px solid #e6e6ea" }}
                    />
                  </label>
                  <button type="submit" style={{ ...btnStyle, background: "#18181b", color: "#fff", borderColor: "#18181b" }}>
                    Email me a link
                  </button>
                </form>
              </div>
            )}

            {account && mine.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {mine.map((w) => (
                  <form key={w.id} action={openMemberWorkspace}>
                    <input type="hidden" name="orgId" value={w.id} />
                    <button type="submit" style={rowStyle}>
                      <span style={{ ...logoStyle, background: w.color }}>{w.letter}</span>
                      <span>
                        <strong>{w.name}</strong>
                        <br />
                        <span style={{ color: "#5f5f6b", fontSize: 12 }}>{w.blurb}</span>
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            )}

            {account && (
              <p style={{ margin: "16px 0 6px", color: "#5f5f6b", fontSize: 12 }}>
                <Link href="/signin">Create a workspace</Link> comes in a later task. For now open a sample below.
              </p>
            )}

            <p style={{ margin: "16px 0 6px", color: "#5f5f6b", fontSize: 12 }}>Sample workspaces</p>
            {samples.map((w) => (
              <form key={w.id} action={openSampleWorkspace}>
                <input type="hidden" name="demo" value={w.id} />
                <button type="submit" style={rowStyle}>
                  <span style={{ ...logoStyle, background: w.color }}>{w.letter}</span>
                  <span>
                    <strong>{w.name}</strong>{" "}
                    <span style={{ fontSize: 11, border: "1px solid #e6e6ea", borderRadius: 999, padding: "1px 8px", color: "#5f5f6b" }}>Sample</span>
                    <br />
                    <span style={{ color: "#5f5f6b", fontSize: 12 }}>{w.blurb}</span>
                  </span>
                </button>
              </form>
            ))}

            <p style={{ marginTop: 16, color: "#5f5f6b", fontSize: 12 }}>
              Each workspace keeps its own people, teams, sources and everything Beacon learns. Nothing crosses between them.
            </p>

            <div style={{ marginTop: 18, borderTop: "1px solid #e6e6ea", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <Link href="/">Back to the site</Link>
              {account ? (
                <form action={signOut}>
                  <button type="submit" style={{ background: "none", border: 0, color: "#5f5f6b", cursor: "pointer", font: "inherit" }}>
                    Sign out
                  </button>
                </form>
              ) : (
                <Link href="/demos">All demos</Link>
              )}
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

const btnStyle: CSSProperties = {
  display: "block",
  textAlign: "center",
  border: "1px solid #e6e6ea",
  borderRadius: 7,
  padding: "8px 11px",
  background: "#fff",
  color: "#18181b",
  textDecoration: "none",
  cursor: "pointer",
  font: "inherit",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  border: "1px solid #e6e6ea",
  borderRadius: 10,
  padding: 12,
  marginTop: 8,
  background: "#fff",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const logoStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  display: "grid",
  placeItems: "center",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  flex: "none",
};
