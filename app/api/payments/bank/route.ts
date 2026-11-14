import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getSessionUser } from "@/lib/auth/session";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/images";
import { submitBankTransfer } from "@/lib/payments/service";
import { rateLimit } from "@/lib/rate-limit";
import { storePrivateFile } from "@/lib/storage";

/** Bank transfer: upload the deposit slip (private) and mark the payment for staff verification. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!rateLimit(`bank:${user.id}`, 10, 60 * 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const pid = String(form?.get("paymentId") ?? "");
  const reference = String(form?.get("reference") ?? "").trim();
  const file = form?.get("file");
  if (!/^[a-f0-9]{24}$/.test(pid) || !(file instanceof File) || reference.length < 3) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = buf.subarray(0, 5).toString("ascii") === "%PDF-";
  const img = sniffImageType(buf);
  if (!isPdf && (!img || img === "heic")) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  const out = isPdf ? buf : await sharp(buf).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const key = await storePrivateFile(["payments", pid], `slip-${randomBytes(12).toString("hex")}.${isPdf ? "pdf" : "jpg"}`, out);
  const ok = await submitBankTransfer(pid, user.id, key, reference);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
