import { NextResponse } from "next/server";
import { resolvePropertySlug } from "@/lib/properties/queries";

/**
 * Used by middleware to answer old/changed slugs with 301 and deleted
 * listings with 410 before rendering (fix #6, #23). Public and read-only:
 * it reveals no more than visiting the URL would.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200) {
    return NextResponse.json({ kind: "missing" });
  }
  const r = await resolvePropertySlug(slug);
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
