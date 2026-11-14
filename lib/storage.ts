import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { IMAGE_WIDTHS, processImage, type ProcessedImage } from "./images";

/**
 * File storage. Local disk today:
 *  - public listing photos → public/uploads/p/<propertyId>/<hash>-<w>.<fmt>
 *    (content-addressed names, so they can be cached for a year)
 *  - private documents     → storage/private/... (never served publicly)
 * An S3/MinIO driver with the same functions is added with deployment (Phase 7).
 */

const PUBLIC_ROOT = path.join(process.cwd(), "public", "uploads");
const PRIVATE_ROOT = path.join(process.cwd(), "storage", "private");

const safeSegment = (s: string) => {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(s)) throw new Error("Invalid path segment");
  return s;
};

export async function storePropertyImage(propertyId: string, buf: Buffer): Promise<ProcessedImage> {
  const dir = path.join(PUBLIC_ROOT, "p", safeSegment(propertyId));
  const baseName = createHash("sha256").update(buf).digest("hex").slice(0, 20);
  return processImage(buf, { dir, baseName, publicPrefix: `/uploads/p/${propertyId}` });
}

/** Delete every size/format variant of an uploaded listing photo. */
export async function deletePropertyImage(propertyId: string, url: string): Promise<void> {
  const m = url.match(new RegExp(`^/uploads/p/${safeSegment(propertyId)}/([a-f0-9]{20})-\\d+\\.(webp|avif)$`));
  if (!m) return; // demo or foreign image: leave it alone
  const dir = path.join(PUBLIC_ROOT, "p", propertyId);
  await Promise.all(
    IMAGE_WIDTHS.flatMap((w) => ["webp", "avif"].map((ext) => fs.rm(path.join(dir, `${m[1]}-${w}.${ext}`), { force: true }))),
  );
}

export async function storePrivateFile(folder: string[], fileName: string, buf: Buffer): Promise<string> {
  const rel = [...folder.map(safeSegment), fileName.replace(/[^a-zA-Z0-9._-]/g, "")].join("/");
  const full = path.join(PRIVATE_ROOT, rel);
  if (!full.startsWith(PRIVATE_ROOT)) throw new Error("Invalid path");
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf);
  return `private:${rel}`;
}

export async function readPrivateFile(key: string): Promise<Buffer | null> {
  if (!key.startsWith("private:")) return null;
  const full = path.normalize(path.join(PRIVATE_ROOT, key.slice(8)));
  if (!full.startsWith(PRIVATE_ROOT)) return null;
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}
