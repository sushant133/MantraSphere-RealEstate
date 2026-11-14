import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Shared assets for next/og images (fonts with Devanagari support, logo). */

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;
export function ogFonts() {
  fontsPromise ??= Promise.all([
    fs.readFile(path.join(process.cwd(), "assets/fonts/Mukta-Regular.ttf")),
    fs.readFile(path.join(process.cwd(), "assets/fonts/Mukta-Bold.ttf")),
  ]).then(([regular, bold]) => [
    { name: "Mukta", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Mukta", data: bold, weight: 700 as const, style: "normal" as const },
  ]);
  return fontsPromise;
}

export const LOGO_SVG = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#1f2a5c"/><circle cx="20" cy="14.5" r="5" fill="#f2a93b"/><path d="M8 29.5 20 19l12 10.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 31.5v-5.2M26 31.5v-5.2" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>',
).toString("base64")}`;

/** Read a public image (WebP) and return a JPEG data URL sized for 1200×630 (satori can't decode WebP). */
export async function publicImageAsJpeg(publicUrl: string): Promise<string | null> {
  if (!publicUrl.startsWith("/uploads/")) return null;
  const rel = path.normalize(publicUrl).replace(/^([/\\])+/, "");
  if (rel.includes("..")) return null;
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(path.join(process.cwd(), "public", rel)).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export const OG_SIZE = { width: 1200, height: 630 };
