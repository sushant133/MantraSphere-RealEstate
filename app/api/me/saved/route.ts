import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB, trusted } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { Property, SavedProperty } from "@/models";

export const dynamic = "force-dynamic";

/**
 * Account-synced saved properties. The device keeps its own list
 * (localStorage) so saving works without an account; when logged in the
 * browser merges both lists here and mirrors every toggle.
 */
const code = z.string().regex(/^MSR-\d{6,}$/);
const body = z.object({
  merge: z.array(code).max(200).optional(), // device list to union in
  add: code.optional(),
  remove: code.optional(),
});

const MAX_SAVED = 200;

async function codesFor(userId: string): Promise<string[]> {
  const rows = await SavedProperty.find({ user: userId }).sort({ createdAt: -1 }).limit(MAX_SAVED).populate<{ property: { code: string } | null }>("property", "code").lean();
  return rows.map((r) => r.property?.code).filter((c): c is string => !!c);
}

export async function GET() {
  const user = await getSessionUser();
  // Anonymous visitors get 200 + null (not 401) so the browser console stays clean.
  if (!user) return NextResponse.json({ codes: null }, { headers: { "Cache-Control": "private, no-store" } });
  await connectDB();
  return NextResponse.json({ codes: await codesFor(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  // Anonymous visitors get 200 + null (not 401) so the browser console stays clean.
  if (!user) return NextResponse.json({ codes: null }, { headers: { "Cache-Control": "private, no-store" } });
  if (!rateLimit(`saved:${user.id}`, 120, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { merge = [], add, remove } = parsed.data;
  await connectDB();

  const wanted = [...new Set([...merge, ...(add ? [add] : [])])];
  if (wanted.length) {
    const props = await Property.find({ code: trusted({ $in: wanted }), status: trusted({ $ne: "DELETED" }) }).select("_id").lean();
    const count = await SavedProperty.countDocuments({ user: user.id });
    const room = Math.max(0, MAX_SAVED - count);
    if (props.length && room) {
      await SavedProperty.bulkWrite(
        props.slice(0, room).map((p) => ({
          updateOne: { filter: { user: user.id, property: p._id }, update: { $setOnInsert: { user: user.id, property: p._id } }, upsert: true },
        })) as never,
        { ordered: false },
      );
    }
  }
  if (remove) {
    const p = await Property.findOne({ code: remove }).select("_id").lean();
    if (p) await SavedProperty.deleteOne({ user: user.id, property: p._id });
  }
  return NextResponse.json({ codes: await codesFor(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}
