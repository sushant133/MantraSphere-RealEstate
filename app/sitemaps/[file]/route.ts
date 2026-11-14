import { getSitemapPosts } from "@/lib/content";
import { getLandingCombos, getSitemapProperties } from "@/lib/properties/queries";
import { PROPERTIES_PER_FILE, urlset, xmlResponse, type SitemapEntry } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** Only pages that exist and are indexable. */
const STATIC_PAGES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: 1 },
  { path: "/properties", changefreq: "daily", priority: 0.9 },
  { path: "/pricing", changefreq: "monthly", priority: 0.6 },
  { path: "/tools/emi-calculator", changefreq: "monthly", priority: 0.6 },
  { path: "/tools/land-unit-converter", changefreq: "monthly", priority: 0.6 },
  { path: "/blog", changefreq: "weekly", priority: 0.5 },
  { path: "/about", changefreq: "monthly", priority: 0.4 },
  { path: "/contact", changefreq: "monthly", priority: 0.4 },
  { path: "/faq", changefreq: "monthly", priority: 0.4 },
  { path: "/privacy", changefreq: "yearly", priority: 0.2 },
  { path: "/terms", changefreq: "yearly", priority: 0.2 },
];

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  if (file === "static.xml") return xmlResponse(urlset(STATIC_PAGES));

  if (file === "blog.xml") {
    const posts = await getSitemapPosts();
    return xmlResponse(urlset(posts.map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updatedAt, changefreq: "monthly", priority: 0.5 }))));
  }

  if (file === "landing.xml") {
    const combos = await getLandingCombos();
    return xmlResponse(urlset(combos.map((c) => ({ path: `/${c.slug}`, changefreq: "daily", priority: c.district ? 0.8 : 0.7 }))));
  }

  const m = file.match(/^properties-(\d{1,5})\.xml$/);
  if (m) {
    const i = Number(m[1]);
    const rows = await getSitemapProperties(i * PROPERTIES_PER_FILE, PROPERTIES_PER_FILE);
    if (!rows.length && i > 0) return new Response("Not found", { status: 404 });
    return xmlResponse(
      urlset(
        rows.map((r) => ({
          path: `/property/${r.slug}`,
          lastmod: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
          changefreq: "weekly",
          priority: 0.6,
          images: ((r.images ?? []) as { url: string; alt?: string }[]).map((img) => ({ url: img.url, title: img.alt })),
        })),
      ),
    );
  }

  return new Response("Not found", { status: 404 });
}
