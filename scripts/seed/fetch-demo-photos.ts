/**
 * Downloads the demo listing photos named in demo-photos.json (CC0 / public
 * domain, found via openverse.org) and runs them through the real upload
 * pipeline into public/uploads/demo-photos/. Only needed once; the processed
 * files are what the seed uses.
 *
 *   npm run seed:photos               # skip files already processed
 *   npm run seed:photos -- --force    # re-download everything
 * `npm run seed` calls this automatically when photos are missing.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { processImage } from "@/lib/images";
import manifest from "./demo-photos.json";

const DIR = path.join(process.cwd(), "public", "uploads", "demo-photos");

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "MantraSphereSeed/1.0 (demo data)" } }).catch(() => null);
    if (res?.ok) return Buffer.from(await res.arrayBuffer());
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error(`download failed: ${url}`);
}

export async function fetchDemoPhotos(force = false, log: (s: string) => void = console.log): Promise<number> {
  let done = 0;
  for (const m of manifest) {
    if (!force && existsSync(path.join(DIR, `${m.file}-1600.webp`))) {
      done++;
      continue;
    }
    try {
      const raw = await download(m.url);
      // Normalise first: landscape 4:3 crop, at most 2000 px wide, so every card/gallery looks consistent.
      const norm = await sharp(raw, { limitInputPixels: 200_000_000 }).rotate().resize(2000, 1500, { fit: "cover", position: "attention" }).jpeg({ quality: 90 }).toBuffer();
      await processImage(norm, { dir: DIR, baseName: m.file, publicPrefix: "/uploads/demo-photos" });
      done++;
      log(`✓ ${m.file}  (${m.source}, ${m.license})`);
    } catch (e) {
      console.error(`✗ ${m.file}: ${(e as Error).message}`);
    }
  }
  log(`${done}/${manifest.length} photos ready in public/uploads/demo-photos`);
  return done;
}

// Run directly: npx tsx scripts/seed/fetch-demo-photos.ts
if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed/fetch-demo-photos.ts")) {
  fetchDemoPhotos(process.argv.includes("--force"));
}
