import { siteUrl } from "../site-url";
import { googleConfigured, microsoftConfigured } from "./config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "./config";

function signState(payload: string): string {
  const sig = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function makeOAuthState(next = "/signin"): string {
  const payload = Buffer.from(JSON.stringify({ n: next, t: Date.now() }), "utf8").toString("base64url");
  return signState(payload);
}

export function readOAuthState(state: string | null): { next: string } {
  if (!state || !state.includes(".")) throw new Error("Invalid OAuth state");
  const [payload, sig] = state.split(".");
  const expect = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid OAuth state");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { n?: string; t?: number };
  if (!data.t || Date.now() - data.t > 15 * 60 * 1000) throw new Error("OAuth state expired");
  const next = data.n?.startsWith("/") && !data.n.startsWith("//") ? data.n : "/signin";
  return { next };
}

export function googleAuthUrl(state: string): string {
  if (!googleConfigured()) throw new Error("Google sign-in is not configured");
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  u.searchParams.set("redirect_uri", `${siteUrl}/api/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export type OAuthProfile = { email: string; name: string; sub: string; emailVerified: boolean };

/** Decode a JWT payload without verifying the signature (token just came from the IdP token endpoint). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
}

export async function exchangeGoogleCode(code: string): Promise<OAuthProfile> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!tokenRes.ok) throw new Error("Google token exchange failed");
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google token missing");
  const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!meRes.ok) throw new Error("Google profile fetch failed");
  const me = (await meRes.json()) as { email?: string; name?: string; sub?: string; email_verified?: boolean };
  if (!me.email || !me.sub) throw new Error("Google profile incomplete");
  // Only treat the address as verified when Google says so — otherwise it must not unlock admin or account linking.
  return { email: me.email, name: me.name || me.email, sub: me.sub, emailVerified: me.email_verified === true };
}

export function microsoftAuthUrl(state: string): string {
  if (!microsoftConfigured()) throw new Error("Microsoft sign-in is not configured");
  const u = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  u.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID!);
  u.searchParams.set("redirect_uri", `${siteUrl}/api/auth/microsoft/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("response_mode", "query");
  u.searchParams.set("scope", "openid profile email User.Read");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeMicrosoftCode(code: string): Promise<OAuthProfile> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    redirect_uri: `${siteUrl}/api/auth/microsoft/callback`,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) throw new Error("Microsoft token exchange failed");
  const token = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!token.access_token) throw new Error("Microsoft token missing");
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!meRes.ok) throw new Error("Microsoft profile fetch failed");
  const me = (await meRes.json()) as { id?: string; displayName?: string; mail?: string; userPrincipalName?: string };
  // Prefer the ID-token email when present; Graph `mail` can be set to any address by a tenant admin.
  let email = (me.mail || me.userPrincipalName || "").toLowerCase();
  let emailVerified = false;
  if (token.id_token) {
    const claims = decodeJwtPayload(token.id_token);
    const claimEmail = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
    if (claimEmail) email = claimEmail;
    // xms_edov is Microsoft's "email domain owner verified" claim (boolean or "1"/"true").
    const edov = claims.xms_edov;
    emailVerified = edov === true || edov === "1" || edov === "true";
  }
  if (!email || !me.id) throw new Error("Microsoft profile incomplete");
  return { email, name: me.displayName || email, sub: me.id, emailVerified };
}
