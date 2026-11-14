/**
 * Generates original illustrated demo photos (no third-party images) and runs
 * them through the real image pipeline, so cards and galleries exercise the
 * same WebP/AVIF/blur code path as owner uploads.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { IMAGE_WIDTHS, processImage, type ProcessedImage } from "@/lib/images";

type Scene = "house" | "land" | "flat" | "commercial";

const PALETTES = [
  { skyTop: "#9cc7ef", skyBottom: "#e9f3fb", hill1: "#7aa874", hill2: "#5e8f5a", ground: "#8fbf6a", wall: "#f4efe6", roof: "#b5523b", accent: "#2f3b6b" },
  { skyTop: "#f6c28b", skyBottom: "#fde9d2", hill1: "#9a8f74", hill2: "#7c735c", ground: "#b7c57a", wall: "#fbf7ef", roof: "#1f2a5c", accent: "#c9762c" },
  { skyTop: "#7fb0d8", skyBottom: "#dcecf7", hill1: "#6c8fa8", hill2: "#4f7189", ground: "#9cc479", wall: "#eef0f4", roof: "#4a5568", accent: "#d4a017" },
  { skyTop: "#b8d8c8", skyBottom: "#f1f8f4", hill1: "#7f9f7a", hill2: "#64835f", ground: "#a7c97d", wall: "#fff8ee", roof: "#8b3a2e", accent: "#22577a" },
];

const W = 1600;
const H = 1200;

function windows(x: number, y: number, cols: number, rows: number, w: number, h: number, gap: number, fill: string) {
  let s = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      s += `<rect x="${x + c * (w + gap)}" y="${y + r * (h + gap)}" width="${w}" height="${h}" rx="6" fill="${fill}" opacity="0.9"/>`;
  return s;
}

function sceneSvg(scene: Scene, v: number): string {
  const p = PALETTES[v % PALETTES.length];
  const bg = `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.skyTop}"/><stop offset="1" stop-color="${p.skyBottom}"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#cfe6f7"/><stop offset="1" stop-color="#7fa7c9"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="${1250 - v * 120}" cy="230" r="90" fill="#fff6d6" opacity="0.85"/>
    <path d="M0 640 C 250 470, 520 520, 760 600 S 1250 460, 1600 590 V ${H} H 0 Z" fill="${p.hill1}"/>
    <path d="M0 720 C 300 620, 650 690, 900 700 S 1350 640, 1600 690 V ${H} H 0 Z" fill="${p.hill2}"/>
    <rect y="820" width="${W}" height="${H - 820}" fill="${p.ground}"/>`;

  let fg = "";
  if (scene === "house") {
    const x = 430 + (v % 2) * 80;
    fg = `
      <rect x="${x}" y="470" width="660" height="400" fill="${p.wall}"/>
      <polygon points="${x - 50},480 ${x + 330},270 ${x + 710},480" fill="${p.roof}"/>
      <rect x="${x}" y="470" width="660" height="18" fill="#000" opacity="0.08"/>
      ${windows(x + 60, 540, 4, 2, 100, 90, 50, "url(#glass)")}
      <rect x="${x + 280}" y="740" width="100" height="130" rx="8" fill="${p.accent}"/>
      <rect x="0" y="866" width="${W}" height="14" fill="#000" opacity="0.06"/>
      <circle cx="${x - 140}" cy="760" r="90" fill="${p.hill2}"/><rect x="${x - 150}" y="790" width="20" height="90" fill="#6b4f3a"/>`;
  } else if (scene === "land") {
    fg = `
      <path d="M0 860 L1600 800 V1200 H0 Z" fill="${p.ground}" />
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${120 + i * 170}" y1="${830 - i * 4}" x2="${120 + i * 170}" y2="${930 - i * 4}" stroke="#7a5a3c" stroke-width="12" stroke-linecap="round"/>`).join("")}
      <line x1="100" y1="860" x2="1520" y2="826" stroke="#7a5a3c" stroke-width="7"/>
      <line x1="100" y1="900" x2="1520" y2="866" stroke="#7a5a3c" stroke-width="7"/>
      <path d="M0 1010 C 400 960, 900 1060, 1600 980 V1200 H0 Z" fill="${p.hill2}" opacity="0.35"/>
      <rect x="1180" y="900" width="230" height="120" rx="10" fill="${p.wall}"/>
      <rect x="1180" y="900" width="230" height="40" rx="10" fill="${p.accent}"/>`;
  } else if (scene === "flat") {
    const x = 560 - (v % 2) * 60;
    fg = `
      <rect x="${x}" y="190" width="480" height="680" fill="${p.wall}"/>
      <rect x="${x}" y="190" width="480" height="30" fill="${p.roof}"/>
      ${windows(x + 40, 250, 4, 7, 80, 60, 30, "url(#glass)")}
      <rect x="${x + 190}" y="790" width="100" height="80" fill="${p.accent}"/>
      <rect x="${x - 260}" y="430" width="220" height="440" fill="${p.wall}" opacity="0.85"/>
      ${windows(x - 230, 470, 2, 5, 70, 50, 30, "url(#glass)")}`;
  } else {
    const x = 380;
    fg = `
      <rect x="${x}" y="380" width="840" height="490" fill="${p.wall}"/>
      <rect x="${x}" y="380" width="840" height="70" fill="${p.accent}"/>
      ${windows(x + 50, 490, 5, 2, 120, 90, 40, "url(#glass)")}
      <rect x="${x + 50}" y="720" width="740" height="150" fill="url(#glass)"/>
      <rect x="${x + 360}" y="720" width="120" height="150" fill="${p.roof}" opacity="0.8"/>
      <rect x="${x - 20}" y="700" width="880" height="20" fill="${p.roof}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${fg}</svg>`;
}

export const SCENE_FOR_TYPE: Record<string, Scene> = {
  HOUSE: "house",
  BUNGALOW: "house",
  LAND: "land",
  FLAT: "flat",
  COMMERCIAL: "commercial",
  OFFICE: "commercial",
  SHOP: "commercial",
};

/** Reuse already-rendered files (re-seeding must not rewrite files a running server may hold open). */
export async function fromExisting(dir: string, baseName: string, publicPrefix: string): Promise<ProcessedImage | null> {
  const sharp = (await import("sharp")).default;
  const sizes: ProcessedImage["sizes"] = [];
  for (const w of IMAGE_WIDTHS) {
    for (const format of ["webp", "avif"] as const) {
      const file = path.join(dir, `${baseName}-${w}.${format}`);
      if (!existsSync(file)) return null;
      const m = await sharp(file).metadata();
      sizes.push({ width: m.width ?? w, url: `${publicPrefix}/${baseName}-${w}.${format}`, format });
    }
  }
  const largest = path.join(dir, `${baseName}-1600.webp`);
  const meta = await sharp(largest).metadata();
  const blur = await sharp(largest).resize(16, 12, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  return {
    url: `${publicPrefix}/${baseName}-1600.webp`,
    width: meta.width ?? 1600,
    height: meta.height ?? 1200,
    blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
    sizes,
  };
}

/** Builds a pool of 4 variants per scene (16 images) and returns them keyed by scene. */
export async function buildDemoImagePool(rootDir: string): Promise<Record<Scene, ProcessedImage[]>> {
  const sharp = (await import("sharp")).default;
  const dir = path.join(rootDir, "public", "uploads", "demo");
  const pool = { house: [], land: [], flat: [], commercial: [] } as Record<Scene, ProcessedImage[]>;
  for (const scene of Object.keys(pool) as Scene[]) {
    for (let v = 0; v < 4; v++) {
      const baseName = `${scene}-${v + 1}`;
      const existing = await fromExisting(dir, baseName, "/uploads/demo");
      if (existing) {
        pool[scene].push(existing);
        continue;
      }
      const png = await sharp(Buffer.from(sceneSvg(scene, v))).png().toBuffer();
      pool[scene].push(await processImage(png, { dir, baseName, publicPrefix: "/uploads/demo" }));
    }
  }
  return pool;
}

// ---- Stock photos (CC0) -------------------------------------------------------------------

/** Photo pools from demo-photos.json, processed by fetch-demo-photos.ts into public/uploads/demo-photos. */
export type PhotoPool = Record<string, ProcessedImage[]>;

export async function loadDemoPhotoPool(rootDir: string): Promise<PhotoPool | null> {
  const manifest = (await import("./demo-photos.json")).default as { file: string; pool: string }[];
  const dir = path.join(rootDir, "public", "uploads", "demo-photos");
  const pool: PhotoPool = {};
  for (const m of manifest) {
    const img = await fromExisting(dir, m.file, "/uploads/demo-photos");
    if (!img) return null; // not downloaded yet → caller falls back to illustrations
    (pool[m.pool] ??= []).push(img);
  }
  return pool;
}

/** Shot list per property type: [pool, room label for alt text]. The first shot is the cover. */
const SHOTS: Record<string, [string, string?][]> = {
  HOUSE: [["house"], ["house", "front view"], ["living", "living room"], ["kitchen", "kitchen"], ["bedroom", "bedroom"], ["bathroom", "bathroom"]],
  BUNGALOW: [["house"], ["house", "front view"], ["living", "living room"], ["kitchen", "kitchen"], ["bedroom", "bedroom"], ["bedroom", "second bedroom"], ["bathroom", "bathroom"]],
  FLAT: [["flat"], ["living", "living room"], ["kitchen", "kitchen"], ["bedroom", "bedroom"], ["bathroom", "bathroom"]],
  LAND: [["land"], ["land", "plot view"], ["land", "surroundings"], ["land", "nearby area"]],
  COMMERCIAL: [["commercial"], ["office", "inside"], ["office", "inside"], ["commercial", "building"]],
  SHOP: [["commercial"], ["commercial", "frontage"], ["office", "inside"]],
  OFFICE: [["office"], ["office", "work area"], ["office", "meeting room"], ["commercial", "building"]],
};

/**
 * Photos for the n-th demo listing of a given type (n counts per type), so
 * covers stay unique within a type while the pool lasts, and a listing never
 * repeats a photo.
 */
export function photosForListing(pool: PhotoPool, type: string, n: number): (ProcessedImage & { room?: string })[] {
  const used = new Map<string, number>();
  return (SHOTS[type] ?? SHOTS.HOUSE).map(([name, room]) => {
    const list = pool[name] ?? [];
    const k = used.get(name) ?? 0;
    used.set(name, k + 1);
    const img = list[(n + k * 7) % list.length];
    return { ...img, room };
  });
}

/** Running counter per cover pool (HOUSE and BUNGALOW share one), so covers repeat only when a pool runs out. */
export function typeOrdinals() {
  const seen = new Map<string, number>();
  return (type: string) => {
    const key = (SHOTS[type] ?? SHOTS.HOUSE)[0][0];
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return n;
  };
}
