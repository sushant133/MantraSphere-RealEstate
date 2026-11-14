import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/**
 * Property URLs: answer changed slugs with a real 301 and deleted listings
 * with 410 Gone (fix #6, #23) — pages can only emit 308/404, so this runs
 * here. Lookups go to /api/internal/slug and are cached briefly per instance.
 */
const PROPERTY_RE = /^\/(en|ne)\/property\/([a-z0-9-]{1,200})\/?$/;

type Resolution = { kind: "ok" | "missing" | "gone" } | { kind: "redirect"; slug: string };
const cache = new Map<string, { v: Resolution; exp: number }>();
const TTL = 60_000;

async function resolve(slug: string, req: NextRequest): Promise<Resolution> {
  const hit = cache.get(slug);
  if (hit && hit.exp > Date.now()) return hit.v;
  const base = process.env.INTERNAL_URL ?? req.nextUrl.origin;
  try {
    const res = await fetch(`${base}/api/internal/slug/${slug}`, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    const v = (await res.json()) as Resolution;
    if (cache.size > 5000) cache.clear();
    cache.set(slug, { v, exp: Date.now() + TTL });
    return v;
  } catch {
    return { kind: "ok" }; // fail open: the page itself still 404s if needed
  }
}

function gone(locale: string) {
  const ne = locale === "ne";
  const html = `<!doctype html><html lang="${ne ? "ne" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${ne ? "सूची हटाइएको छ" : "Listing removed"} | MantraSphere Real Estate</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center;color:#1f2a5c}a{display:inline-block;min-height:44px;line-height:44px;padding:0 20px;border-radius:12px;background:#1f2a5c;color:#fff;text-decoration:none;font-weight:600}</style></head><body><main><p>410</p><h1>${ne ? "यो सूची हटाइएको छ" : "This listing has been removed"}</h1><p>${ne ? "यो सम्पत्ति अब उपलब्ध छैन।" : "This property is no longer available."}</p><a href="/${locale}/properties">${ne ? "अन्य सम्पत्ति हेर्नुहोस्" : "Browse other properties"}</a></main></body></html>`;
  return new NextResponse(html, { status: 410, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}

export default async function middleware(req: NextRequest) {
  const m = req.nextUrl.pathname.match(PROPERTY_RE);
  if (m) {
    const [, locale, slug] = m;
    const r = await resolve(slug, req);
    if (r.kind === "redirect") {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/property/${r.slug}`;
      return NextResponse.redirect(url, 301);
    }
    if (r.kind === "gone") return gone(locale);
  }
  return intl(req);
}

export const config = {
  // Everything except API routes, Next internals, metadata files and static files.
  matcher: ["/((?!api|_next|_vercel|sitemap|sitemaps|robots|manifest|icon|apple-icon|opengraph-image|uploads|.*\\..*).*)"],
};
