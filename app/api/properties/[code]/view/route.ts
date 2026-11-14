import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { Property } from "@/models";

/**
 * View counter beacon. Detail pages are statically cached, so views are
 * counted from the browser; one view per IP per listing per 30 minutes.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^MSR-\d{6,}$/.test(code)) return new NextResponse(null, { status: 400 });
  if (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") {
    return new NextResponse(null, { status: 403 });
  }
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "local";
  if (rateLimit(`view:${code}:${ip}`, 1, 30 * 60_000).ok) {
    await connectDB();
    await Property.updateOne({ code, status: "ACTIVE" }, { $inc: { views: 1 } });
  }
  return new NextResponse(null, { status: 204 });
}
