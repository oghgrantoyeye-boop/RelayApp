import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Every crawler, search engines and AI assistants included, may read the site. API routes are off limits.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
