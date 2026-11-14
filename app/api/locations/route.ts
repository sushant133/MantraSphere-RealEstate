import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { District, Municipality } from "@/models";

/** GET /api/locations?district=<id> → municipalities (with ward counts) for the listing wizard. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("district") ?? "";
  if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ municipalities: [] }, { status: 400 });
  await connectDB();
  const d = await District.findById(id).select("_id center region").lean();
  if (!d) return NextResponse.json({ municipalities: [] }, { status: 404 });
  const rows = await Municipality.find({ district: d._id }).sort({ "name.en": 1 }).select("name wards").lean();
  return NextResponse.json(
    {
      center: d.center ?? null,
      region: d.region,
      municipalities: rows.map((m) => ({ id: String(m._id), en: m.name.en, ne: m.name.ne, wards: m.wards ?? 0 })),
    },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
