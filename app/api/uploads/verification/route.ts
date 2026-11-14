import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { storePrivateFile } from "@/lib/storage";
import { AgentProfile } from "@/models";

const KINDS = ["CITIZENSHIP", "AGENCY_REGISTRATION", "PAN", "OTHER"] as const;

/**
 * Identity / agency documents for the verification badge. Stored privately
 * (never under /public); images are re-encoded to strip EXIF/GPS, PDFs kept as-is.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!rateLimit(`docs:${user.id}`, 10, 60 * 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const kind = String(form?.get("kind") ?? "") as (typeof KINDS)[number];
  const file = form?.get("file");
  if (!KINDS.includes(kind) || !(file instanceof File)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = buf.subarray(0, 5).toString("ascii") === "%PDF-";
  const img = sniffImageType(buf);
  if (!isPdf && (!img || img === "heic")) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });

  const id = randomBytes(12).toString("hex");
  const out = isPdf ? buf : await sharp(buf).rotate().resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const key = await storePrivateFile(["verification", user.id], `${kind.toLowerCase()}-${id}.${isPdf ? "pdf" : "jpg"}`, out);

  await connectDB();
  await AgentProfile.findOneAndUpdate(
    { user: user.id },
    {
      $setOnInsert: { user: user.id, kind: "INDIVIDUAL_OWNER" },
      $push: { documents: { kind, url: key, uploadedAt: new Date() } },
      $set: { verificationStatus: "PENDING" },
    },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
