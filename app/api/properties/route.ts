import { NextResponse, type NextRequest } from "next/server";
import { parseFilters } from "@/lib/properties/filters";
import { getCardsByCodes, searchProperties } from "@/lib/properties/queries";
import { rateLimit } from "@/lib/rate-limit";

/**
 * JSON search used by infinite scroll and the saved page.
 * GET /api/properties?<filters>&cursor=…   |   GET /api/properties?codes=MSR-000001,MSR-000002
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "local";
  if (!rateLimit(`api:props:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const sp = req.nextUrl.searchParams;

  const codes = sp.get("codes");
  if (codes != null) {
    const items = await getCardsByCodes(codes.split(",").map((c) => c.trim().toUpperCase()));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const f = parseFilters(sp);
  const cursorRaw = sp.get("cursor");
  const cursor = cursorRaw && /^[A-Za-z0-9_-]{1,512}$/.test(cursorRaw) ? cursorRaw : null;
  const r = await searchProperties(f, cursor);
  return NextResponse.json(
    { items: r.items, nextCursor: r.nextCursor, page: r.page, pages: r.pages, total: r.total },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
