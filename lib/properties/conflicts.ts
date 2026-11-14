import { toAsciiDigits } from "@/lib/price";
import type { AreaInput } from "@/lib/units";

/**
 * Structured fields are the single source of truth (fix #24). This finds
 * numbers in the free-text description that contradict them, e.g.
 * "only 100 m from the main road" when the field says 10 m.
 */

export type ConflictField = "roadWidthFt" | "mainRoadDistanceM" | "bedrooms" | "bathrooms" | "floors" | "area";
export type Conflict = { field: ConflictField; found: number; expected: number };

export type ConflictInput = {
  roadWidthFt?: number | null;
  mainRoadDistanceM?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  areaInput?: AreaInput | null;
};

const NUM = String.raw`(\d+(?:\.\d+)?)`;

const PATTERNS: { field: ConflictField; re: RegExp; unit?: "aana" | "ropani" | "kattha" | "bigha" }[] = [
  // "13 ft road", "20 feet road", "१३ फिट बाटो"
  { field: "roadWidthFt", re: new RegExp(`${NUM}\\s*(?:ft|feet|foot|फिट)\\.?\\s*(?:wide\\s*)?(?:road|access|bato|बाटो|सडक)`, "giu") },
  // "100 m from (the) main road", "मुख्य सडकबाट 100 मिटर"
  { field: "mainRoadDistanceM", re: new RegExp(`${NUM}\\s*(?:m|mtr|meters?|metres?|मिटर)\\b[^.\\n]{0,25}?(?:main\\s*road|highway|मुख्य\\s*सडक)`, "giu") },
  { field: "mainRoadDistanceM", re: new RegExp(`(?:मुख्य\\s*सडकबाट|from\\s+(?:the\\s+)?main\\s+road)\\s*${NUM}\\s*(?:m|meters?|metres?|मिटर)`, "giu") },
  // "4 bedrooms", "4BHK", "४ शयनकक्ष"
  { field: "bedrooms", re: new RegExp(`${NUM}\\s*(?:bhk|bed\\s*rooms?|beds?|शयनकक्ष|बेडरुम)`, "giu") },
  { field: "bathrooms", re: new RegExp(`${NUM}\\s*(?:bath\\s*rooms?|baths?|toilets?|बाथरुम|शौचालय)`, "giu") },
  { field: "floors", re: new RegExp(`${NUM}\\s*(?:storey|story|stories|storeys|floors?|तल्ले|तला)`, "giu") },
  { field: "area", unit: "aana", re: new RegExp(`${NUM}\\s*(?:aana|ana|आना)`, "giu") },
  { field: "area", unit: "ropani", re: new RegExp(`${NUM}\\s*(?:ropani|रोपनी)`, "giu") },
  { field: "area", unit: "kattha", re: new RegExp(`${NUM}\\s*(?:kattha|katha|कट्ठा)`, "giu") },
  { field: "area", unit: "bigha", re: new RegExp(`${NUM}\\s*(?:bigha|बिघा)`, "giu") },
];

function areaValue(a: AreaInput | null | undefined, unit: "aana" | "ropani" | "kattha" | "bigha"): number | null {
  if (!a) return null;
  if (a.system === "RAPD") {
    const v = a.values;
    if (unit === "aana") return v.ropani * 16 + v.aana; // "20 aana" is common for 1 ropani 4 aana
    if (unit === "ropani") return v.ropani;
  }
  if (a.system === "BKD") {
    const v = a.values;
    if (unit === "kattha") return v.bigha * 20 + v.kattha;
    if (unit === "bigha") return v.bigha;
  }
  return null;
}

export function findConflicts(description: string, f: ConflictInput): Conflict[] {
  const text = toAsciiDigits(description ?? "").toLowerCase();
  if (!text.trim()) return [];
  const out: Conflict[] = [];
  const seen = new Set<string>();
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    for (const m of text.matchAll(p.re)) {
      const found = parseFloat(m[1]);
      let expected: number | null | undefined;
      if (p.field === "area") {
        expected = areaValue(f.areaInput, p.unit!);
        // "1 ropani 4 aana": the aana figure is the remainder, so also accept it.
        if (p.unit === "aana" && f.areaInput?.system === "RAPD" && found === f.areaInput.values.aana) continue;
        if (p.unit === "kattha" && f.areaInput?.system === "BKD" && found === f.areaInput.values.kattha) continue;
      } else {
        expected = f[p.field];
      }
      if (expected == null || !Number.isFinite(found)) continue;
      if (Math.abs(found - expected) > 1e-6) {
        const key = `${p.field}:${found}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ field: p.field, found, expected });
        }
      }
    }
  }
  return out;
}
