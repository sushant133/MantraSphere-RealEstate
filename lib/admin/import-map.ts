import { FACINGS, FURNISHINGS, PROPERTY_TYPES, PURPOSES, ROAD_TYPES } from "@/lib/constants";
import { draftSchema, submitIssues, type DraftInput, type SubmitIssue } from "@/lib/properties/listing-schema";
import { parsePrice, PRICE_UNITS, toAsciiDigits } from "@/lib/price";
import type { AreaInput } from "@/lib/units";

/**
 * Bulk import of the company's own listings (CSV / Excel). Pure mapping +
 * validation so it can be unit-tested; location lookups are injected.
 */

export const IMPORT_COLUMNS = [
  "purpose", "type", "district", "municipality", "ward", "address", "lat", "lng",
  "area", "area_unit", "built_up_sqft", "price", "price_unit", "price_on_request", "negotiable",
  "bedrooms", "bathrooms", "kitchens", "living_rooms", "floors", "parking",
  "facing", "road_width_ft", "road_type", "main_road_m", "furnishing", "built_year", "ready_to_move",
  "description_en", "description_ne", "contact_name", "contact_phone", "plan", "publish",
] as const;

export const IMPORT_EXAMPLE: Record<(typeof IMPORT_COLUMNS)[number], string> = {
  purpose: "sale", type: "land", district: "Bhaktapur", municipality: "Suryabinayak", ward: "4", address: "Sallaghari",
  lat: "27.6702", lng: "85.4401", area: "0-8-0-0", area_unit: "ropani", built_up_sqft: "", price: "2.5 crore",
  price_unit: "total", price_on_request: "no", negotiable: "yes", bedrooms: "", bathrooms: "", kitchens: "",
  living_rooms: "", floors: "", parking: "", facing: "east", road_width_ft: "13", road_type: "blacktopped",
  main_road_m: "150", furnishing: "", built_year: "", ready_to_move: "", description_en: "Flat plot with 13 ft road access.",
  description_ne: "", contact_name: "MantraSphere Real Estate", contact_phone: "9849361011", plan: "normal", publish: "yes",
};

export type Lookup = {
  district: (name: string) => { id: string; terai: boolean } | null;
  municipality: (districtId: string, name: string) => { id: string; wards: number } | null;
  planExists: (slug: string) => boolean;
};

export type MappedRow = { row: number; draft: DraftInput | null; publish: boolean; errors: string[]; issues: SubmitIssue[] };

const norm = (s: unknown) => toAsciiDigits(String(s ?? "")).trim();
const yes = (s: string) => /^(y|yes|true|1|हो)$/i.test(s);
const num = (s: string, errors: string[], col: string, int = false): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n) || (int && !Number.isInteger(n))) {
    errors.push(`${col}: “${s}” is not a ${int ? "whole " : ""}number`);
    return null;
  }
  return n;
};
const enumOf = <T extends string>(s: string, values: readonly T[], col: string, errors: string[]): T | null => {
  if (!s) return null;
  const v = s.toUpperCase().replace(/[\s-]+/g, "_") as T;
  if (values.includes(v)) return v;
  errors.push(`${col}: “${s}” must be one of ${values.join(", ").toLowerCase()}`);
  return null;
};

/** "1-4-0-0" (ropani-aana-paisa-daam), "2-5-0" (bigha-kattha-dhur), or a number with sqft/sqm. */
export function parseArea(raw: string, unit: string): AreaInput | null {
  const s = toAsciiDigits(raw).trim();
  const u = unit.trim().toLowerCase();
  if (!s) return null;
  const parts = s.split(/[-–\s/]+/).map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (["ropani", "rapd", "aana", "ropani-aana"].includes(u) || (!u && parts.length === 4)) {
    const [ropani = 0, aana = 0, paisa = 0, daam = 0] = parts.length === 1 && u === "aana" ? [0, parts[0], 0, 0] : parts;
    return { system: "RAPD", values: { ropani, aana, paisa, daam } };
  }
  if (["bigha", "bkd", "kattha", "bigha-kattha"].includes(u) || (!u && parts.length === 3)) {
    const [bigha = 0, kattha = 0, dhur = 0] = parts.length === 1 && u === "kattha" ? [0, parts[0], 0] : parts;
    return { system: "BKD", values: { bigha, kattha, dhur } };
  }
  if (parts.length !== 1) return null;
  if (["sqm", "sq m", "m2"].includes(u)) return { system: "SQM", values: { sqm: parts[0] } };
  return { system: "SQFT", values: { sqft: parts[0] } };
}

export function mapRow(rowNo: number, rec: Record<string, unknown>, lk: Lookup): MappedRow {
  const r = Object.fromEntries(Object.entries(rec).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, "_"), norm(v)]));
  const errors: string[] = [];
  const purpose = enumOf(r.purpose === "buy" ? "sale" : r.purpose, PURPOSES, "purpose", errors);
  const type = enumOf(r.type === "apartment" ? "flat" : r.type, PROPERTY_TYPES, "type", errors);
  if (!purpose || !type) {
    if (!r.purpose) errors.push("purpose is required");
    if (!r.type) errors.push("type is required");
    return { row: rowNo, draft: null, publish: false, errors, issues: [] };
  }

  const d = r.district ? lk.district(r.district) : null;
  if (r.district && !d) errors.push(`district: “${r.district}” not found`);
  const m = d && r.municipality ? lk.municipality(d.id, r.municipality) : null;
  if (d && r.municipality && !m) errors.push(`municipality: “${r.municipality}” is not in ${r.district}`);
  const ward = num(r.ward, errors, "ward", true);
  if (ward != null && m && (ward < 1 || ward > m.wards)) errors.push(`ward: ${ward} is outside 1–${m.wards}`);

  const areaInput = r.area ? parseArea(r.area, r.area_unit) : null;
  if (r.area && !areaInput) errors.push(`area: “${r.area}” is not understood (use 1-4-0-0, 2-5-0 or a number)`);

  const priceOnRequest = yes(r.price_on_request);
  const priceNpr = r.price ? parsePrice(r.price) : null;
  if (r.price && !priceNpr) errors.push(`price: “${r.price}” is not understood (e.g. 4500000, 45 lakh, 2.1 crore)`);
  const unitRaw = r.price_unit ? (r.price_unit.toLowerCase() === "total" ? "TOTAL" : `PER_${r.price_unit.replace(/^per[\s_-]*/i, "").toUpperCase()}`) : purpose === "SALE" ? "TOTAL" : "PER_MONTH";
  const priceUnit = (PRICE_UNITS as readonly string[]).includes(unitRaw) ? (unitRaw as DraftInput["priceUnit"]) : (errors.push(`price_unit: “${r.price_unit}” is not valid`), "TOTAL");
  const plan = (r.plan || "normal").toLowerCase();
  if (!lk.planExists(plan)) errors.push(`plan: “${r.plan}” does not exist`);

  const candidate = {
    purpose,
    type,
    districtId: d?.id ?? null,
    municipalityId: m?.id ?? null,
    ward,
    address: r.address ?? "",
    lat: num(r.lat, errors, "lat"),
    lng: num(r.lng, errors, "lng"),
    areaInput,
    builtUpAreaSqFt: num(r.built_up_sqft, errors, "built_up_sqft"),
    priceOnRequest,
    priceNpr: priceOnRequest ? null : priceNpr,
    priceUnit,
    negotiable: yes(r.negotiable),
    bedrooms: num(r.bedrooms, errors, "bedrooms", true),
    bathrooms: num(r.bathrooms, errors, "bathrooms", true),
    kitchens: num(r.kitchens, errors, "kitchens", true),
    livingRooms: num(r.living_rooms, errors, "living_rooms", true),
    floors: num(r.floors, errors, "floors"),
    parking: num(r.parking, errors, "parking", true),
    facing: enumOf(r.facing, FACINGS, "facing", errors),
    roadWidthFt: num(r.road_width_ft, errors, "road_width_ft"),
    roadType: enumOf(r.road_type, ROAD_TYPES, "road_type", errors),
    mainRoadDistanceM: num(r.main_road_m, errors, "main_road_m", true),
    furnishing: enumOf(r.furnishing ? (r.furnishing.toLowerCase().startsWith("semi") ? "SEMI_FURNISHED" : r.furnishing.toLowerCase().startsWith("full") ? "FULLY_FURNISHED" : r.furnishing.toLowerCase().startsWith("un") ? "UNFURNISHED" : r.furnishing) : "", FURNISHINGS, "furnishing", errors),
    builtYear: num(r.built_year, errors, "built_year", true),
    readyToMove: r.ready_to_move ? yes(r.ready_to_move) : null,
    descriptionEn: r.description_en ?? "",
    descriptionNe: r.description_ne ?? "",
    contactName: r.contact_name ?? "",
    contactPhone: r.contact_phone ?? "",
    whatsapp: r.contact_phone ?? "",
    planSlug: plan,
    images: [],
  };
  const parsed = draftSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors.push(`${String(i.path[0])}: ${i.message}`);
    return { row: rowNo, draft: null, publish: false, errors, issues: [] };
  }
  const issues = submitIssues(parsed.data, { terai: !!d?.terai, maxPhotos: 30, imageCount: 0 });
  return { row: rowNo, draft: parsed.data, publish: yes(r.publish), errors, issues };
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): Record<string, string>[] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ""));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
