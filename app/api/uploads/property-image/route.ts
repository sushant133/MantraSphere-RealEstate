import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB, trusted } from "@/lib/db";
import { MAX_UPLOAD_BYTES, sniffImageType, suggestAlt } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { deletePropertyImage, storePropertyImage } from "@/lib/storage";
import { Property } from "@/models";

/** Hard cap across all plans; the chosen plan's limit is enforced on submit. */
const MAX_IMAGES = 30;
const EDITABLE = ["DRAFT", "REJECTED"];

/**
 * POST multipart/form-data { propertyId, file } → appends the processed photo
 * to the listing. The server builds the image record, so the client can never
 * point a listing at arbitrary URLs.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!rateLimit(`upload:${user.id}`, 120, 60 * 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const propertyId = String(form?.get("propertyId") ?? "");
  const file = form?.get("file");
  if (!mongoose.isValidObjectId(propertyId) || !(file instanceof File)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImageType(buf);
  if (!kind || kind === "heic") return NextResponse.json({ error: "unsupported_type" }, { status: 415 });

  await connectDB();
  const prop = await Property.findOne({ _id: propertyId, owner: user.id }).select("status images title locationNames address");
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!EDITABLE.includes(prop.status)) return NextResponse.json({ error: "not_editable" }, { status: 409 });
  if (prop.images.length >= MAX_IMAGES) return NextResponse.json({ error: "too_many" }, { status: 409 });

  let img;
  try {
    img = await storePropertyImage(propertyId, buf);
  } catch {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }
  const place = [prop.address, prop.locationNames?.district?.en].filter(Boolean).join(", ");
  const record = {
    url: img.url,
    sizes: img.sizes,
    width: img.width,
    height: img.height,
    blurDataURL: img.blurDataURL,
    alt: suggestAlt(prop.title?.en || "Property photo", place || "Nepal", prop.images.length),
    order: prop.images.length,
    isCover: prop.images.length === 0,
  };
  // Atomic append guarded by the cap (no race between parallel uploads).
  const updated = await Property.findOneAndUpdate(
    { _id: propertyId, owner: user.id, [`images.${MAX_IMAGES - 1}`]: trusted({ $exists: false }) },
    { $push: { images: record } },
    { new: true, projection: { images: { $slice: -1 } } },
  ).lean();
  const saved = updated?.images?.[0];
  if (!saved) {
    await deletePropertyImage(propertyId, img.url);
    return NextResponse.json({ error: "too_many" }, { status: 409 });
  }
  return NextResponse.json({
    image: { id: String(saved._id), url: saved.url, width: saved.width, height: saved.height, blurDataURL: saved.blurDataURL, alt: saved.alt, isCover: saved.isCover },
  });
}
