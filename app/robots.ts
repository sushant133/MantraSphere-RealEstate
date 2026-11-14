import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/constants";
import { SITE_URL } from "@/lib/seo";

/** robots.txt (fix #5): crawl public pages; keep admin, dashboard, auth and API out. */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["dashboard", "admin", "login", "register", "saved", "compare"].flatMap((p) => LOCALES.map((l) => `/${l}/${p}`));
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", ...privatePaths, "/*?*cursor="],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
