import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Image pipeline: auto-rotate, strip EXIF/GPS (sharp drops metadata unless
 * asked to keep it), resize to 400/800/1600 px, encode WebP + AVIF, and make
 * a tiny blur placeholder. Output goes to local disk under /public/uploads;
 * lib/storage.ts (Phase 3) adds MinIO/S3.
 */

export const IMAGE_WIDTHS = [400, 800, 1600] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ProcessedImage = {
  url: string; // largest WebP, used as the canonical src
  width: number;
  height: number;
  blurDataURL: string;
  sizes: { width: number; url: string; format: "webp" | "avif" }[];
};

/** Validate by magic bytes, never by extension or client MIME type. */
export function sniffImageType(buf: Buffer): "jpeg" | "png" | "webp" | "avif" | "heic" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

export async function processImage(
  input: Buffer,
  opts: { dir: string; baseName: string; publicPrefix: string; avif?: boolean },
): Promise<ProcessedImage> {
  if (input.length > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 10 MB");
  if (!sniffImageType(input)) throw new Error("Unsupported image type");

  const base = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
  const meta = await base.metadata();
  const srcW = meta.autoOrient?.width ?? meta.width ?? 1600;
  const srcH = meta.autoOrient?.height ?? meta.height ?? 1200;

  await fs.mkdir(opts.dir, { recursive: true });
  const sizes: ProcessedImage["sizes"] = [];
  let largest = { width: 0, height: 0, url: "" };

  for (const w of IMAGE_WIDTHS) {
    const width = Math.min(w, srcW);
    const resized = base.clone().resize({ width, withoutEnlargement: true });
    const webpName = `${opts.baseName}-${w}.webp`;
    const info = await resized.clone().webp({ quality: 78, effort: 4 }).toFile(path.join(opts.dir, webpName));
    sizes.push({ width: info.width, url: `${opts.publicPrefix}/${webpName}`, format: "webp" });
    if (opts.avif !== false) {
      const avifName = `${opts.baseName}-${w}.avif`;
      await resized.clone().avif({ quality: 55, effort: 3 }).toFile(path.join(opts.dir, avifName));
      sizes.push({ width: info.width, url: `${opts.publicPrefix}/${avifName}`, format: "avif" });
    }
    if (info.width >= largest.width) largest = { width: info.width, height: info.height, url: `${opts.publicPrefix}/${webpName}` };
  }

  const blur = await base.clone().resize(16, 12, { fit: "inside" }).webp({ quality: 40 }).toBuffer();

  return {
    url: largest.url,
    width: largest.width || srcW,
    height: largest.height || srcH,
    blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
    sizes,
  };
}

/** Alt text suggestion from title + location (fix #29); owner can edit it. */
export function suggestAlt(title: string, location: string, index: number): string {
  const n = index === 0 ? "" : ` – photo ${index + 1}`;
  return `${title}, ${location}${n}`.slice(0, 160);
}
