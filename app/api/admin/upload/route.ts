import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { can } from "@/lib/admin/auth";
import { getSessionUser } from "@/lib/auth/session";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/images";

/** CMS images (blog covers, banners): staff only, re-encoded to WebP ≤ 1600 px, metadata stripped. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !can(user.role, "content")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImageType(buf);
  if (!kind || kind === "heic") return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  const name = `${randomBytes(10).toString("hex")}.webp`;
  const dir = path.join(process.cwd(), "public", "uploads", "cms");
  await fs.mkdir(dir, { recursive: true });
  const info = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(dir, name));
  return NextResponse.json({ url: `/uploads/cms/${name}`, width: info.width, height: info.height });
}
