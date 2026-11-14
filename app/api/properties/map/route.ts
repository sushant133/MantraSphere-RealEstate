import { NextResponse, type NextRequest } from "next/server";
import { parseFilters } from "@/lib/properties/filters";
import { getMapPoints } from "@/lib/properties/queries";
import { rateLimit } from "@/lib/rate-limit";

/** GET /api/properties/map?<filters>&bbox=west,south,east,north */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "local";
  if (!rateLimit(`api:map:${ip}`, 60, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp);
  let bbox: [number, number, number, number] | null = null;
  const raw = sp.get("bbox");
  if (raw) {
    const n = raw.split(",").map(Number);
    const valid = n.length === 4 && n.every(Number.isFinite) && n[0] < n[2] && n[1] < n[3] && n[0] >= -180 && n[2] <= 180 && n[1] >= -90 && n[3] <= 90;
    if (valid) bbox = [n[0], n[1], n[2], n[3]];
  }
  const data = await getMapPoints(f, bbox);
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
