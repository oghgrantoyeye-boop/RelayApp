// The public address of the site: NEXT_PUBLIC_SITE_URL if set (use it for a custom domain),
// otherwise Vercel's production domain, otherwise localhost.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
