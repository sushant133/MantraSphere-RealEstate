import "server-only";
import { LOCALES } from "@/lib/constants";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

/** Hand-rolled sitemap XML (index + split files with hreflang alternates and images, fix #5). */

export const URLS_PER_FILE = 5000;
/** Each property is listed once per locale. */
export const PROPERTIES_PER_FILE = Math.floor(URLS_PER_FILE / LOCALES.length);

export const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export type SitemapEntry = {
  path: string; // locale-relative, e.g. "/property/abc-msr-000001"
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
  images?: { url: string; title?: string }[];
};

export function urlset(entries: SitemapEntry[]): string {
  const rows = entries.flatMap((e) =>
    LOCALES.map((locale) => {
      const alts = LOCALES.map(
        (l) => `<xhtml:link rel="alternate" hreflang="${l === "ne" ? "ne-NP" : "en-NP"}" href="${xmlEscape(absoluteUrl(l, e.path))}"/>`,
      ).join("");
      const xdef = `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(absoluteUrl("en", e.path))}"/>`;
      const imgs = (e.images ?? [])
        .map(
          (i) =>
            `<image:image><image:loc>${xmlEscape(i.url.startsWith("http") ? i.url : `${SITE_URL}${i.url}`)}</image:loc>${i.title ? `<image:title>${xmlEscape(i.title)}</image:title>` : ""}</image:image>`,
        )
        .join("");
      return `<url><loc>${xmlEscape(absoluteUrl(locale, e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority != null ? `<priority>${e.priority.toFixed(1)}</priority>` : ""}${alts}${xdef}${imgs}</url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${rows.join("")}</urlset>`;
}

export function sitemapIndex(files: string[]): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files
    .map((f) => `<sitemap><loc>${xmlEscape(`${SITE_URL}/sitemaps/${f}`)}</loc><lastmod>${now}</lastmod></sitemap>`)
    .join("")}</sitemapindex>`;
}

export const xmlResponse = (body: string) =>
  new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
