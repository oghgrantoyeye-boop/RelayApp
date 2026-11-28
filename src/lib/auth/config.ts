/** Sign-in providers and secrets. Missing values keep sample workspaces available. */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (s) return s;
  // Local/demo only. Production must set AUTH_SECRET in Vercel.
  if (process.env.VERCEL_ENV === "production") throw new Error("AUTH_SECRET is required in production");
  return "beacon-dev-auth-secret-not-for-production";
}

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function microsoftConfigured() {
  return !!(process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim());
}

export function emailConfigured() {
  return !!process.env.EMAIL_SERVER?.trim();
}

export function authProviders() {
  return {
    google: googleConfigured(),
    microsoft: microsoftConfigured(),
    email: true, // magic links always work; without EMAIL_SERVER the link is returned for tests/dev
    emailSends: emailConfigured(),
  };
}
