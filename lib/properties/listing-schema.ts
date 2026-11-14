import { z } from "zod";
import {
  FACINGS,
  FURNISHINGS,
  OWNERSHIP_TYPES,
  PROPERTY_TYPES,
  PURPOSES,
  ROAD_TYPES,
  TYPE_FIELDS,
  type PropertyType,
  type Purpose,
} from "@/lib/constants";
import { PRICE_UNITS, type PriceUnit } from "@/lib/price";
import { isPositiveArea } from "@/lib/units";
import { normalizePhone } from "@/lib/phone";

/**
 * Listing input validation, shared by the wizard (client) and the server
 * actions. `draftSchema` accepts partial data for autosave; `submitIssues`
 * applies the complete, type-specific rules before review.
 */

const objectId = z.string().regex(/^[a-f0-9]{24}$/);
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const num = (min: number, max: number) => z.number().finite().min(min).max(max);

export const areaInputSchema = z.discriminatedUnion("system", [
  z.object({ system: z.literal("RAPD"), values: z.object({ ropani: int(0, 10_000), aana: int(0, 15), paisa: int(0, 3), daam: num(0, 3.99) }) }),
  z.object({ system: z.literal("BKD"), values: z.object({ bigha: int(0, 10_000), kattha: int(0, 19), dhur: num(0, 19.99) }) }),
  z.object({ system: z.literal("SQFT"), values: z.object({ sqft: num(0, 1e8) }) }),
  z.object({ system: z.literal("SQM"), values: z.object({ sqm: num(0, 1e7) }) }),
]);

const NEARBY_KINDS = ["SCHOOL", "HOSPITAL", "BUS_STOP", "MARKET", "TEMPLE", "BANK", "OTHER"] as const;

export const draftSchema = z
  .object({
    purpose: z.enum(PURPOSES),
    type: z.enum(PROPERTY_TYPES),
    districtId: objectId.nullable(),
    municipalityId: objectId.nullable(),
    ward: int(1, 40).nullable(),
    address: z.string().trim().max(200),
    lat: num(26, 31).nullable(),
    lng: num(79, 89).nullable(),
    areaInput: areaInputSchema.nullable(),
    builtUpAreaSqFt: num(0, 1e8).nullable(),
    priceOnRequest: z.boolean(),
    priceNpr: z.number().int().min(1).max(9e15).nullable(),
    priceUnit: z.enum(PRICE_UNITS),
    negotiable: z.boolean(),
    facing: z.enum(FACINGS).nullable(),
    roadWidthFt: num(0, 300).nullable(),
    roadType: z.enum(ROAD_TYPES).nullable(),
    mainRoadDistanceM: int(0, 100_000).nullable(),
    floors: num(0, 100).nullable(),
    bedrooms: int(0, 100).nullable(),
    bathrooms: int(0, 100).nullable(),
    kitchens: int(0, 50).nullable(),
    livingRooms: int(0, 50).nullable(),
    parking: int(0, 500).nullable(),
    furnishing: z.enum(FURNISHINGS).nullable(),
    builtYear: int(1900, 2200).nullable(),
    readyToMove: z.boolean().nullable(),
    ownershipType: z.enum(OWNERSHIP_TYPES).nullable(),
    amenities: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(40),
    nearby: z
      .array(z.object({ kind: z.enum(NEARBY_KINDS), name: z.string().trim().min(1).max(120), distanceM: int(0, 100_000).nullable() }))
      .max(12),
    youtubeUrl: z.string().trim().max(300),
    tourUrl: z.string().trim().max(300),
    descriptionEn: z.string().max(5000),
    descriptionNe: z.string().max(5000),
    // Images are uploaded separately; here only order, alt text and cover change.
    images: z.array(z.object({ id: objectId, alt: z.string().trim().max(160), isCover: z.boolean() })).max(30),
    contactName: z.string().trim().max(80),
    contactPhone: z.string().trim().max(20),
    whatsapp: z.string().trim().max(20),
    viber: z.string().trim().max(20),
    planSlug: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable(),
  })
  .partial()
  .required({ purpose: true, type: true });

export type DraftInput = z.infer<typeof draftSchema>;

/** Price units that make sense for a purpose/type. Rent is always per month (fix #17). */
export function allowedPriceUnits(purpose: Purpose, type: PropertyType, terai: boolean): PriceUnit[] {
  if (purpose !== "SALE") return ["PER_MONTH"];
  if (type === "LAND") return terai ? ["TOTAL", "PER_KATTHA", "PER_DHUR", "PER_SQFT"] : ["TOTAL", "PER_AANA", "PER_ROPANI", "PER_SQFT"];
  if (type === "COMMERCIAL" || type === "OFFICE" || type === "SHOP") return ["TOTAL", "PER_SQFT"];
  return ["TOTAL"];
}

export const isYoutubeUrl = (u: string) => /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/.test(u);
export const isHttpsUrl = (u: string) => /^https:\/\/[^\s]{4,300}$/.test(u);

export type SubmitIssue =
  | "district"
  | "municipality"
  | "pin"
  | "area"
  | "price"
  | "priceUnit"
  | "bedrooms"
  | "contactName"
  | "contactPhone"
  | "whatsapp"
  | "viber"
  | "plan"
  | "photosAlt"
  | "photosTooMany"
  | "youtube"
  | "tour";

/** Complete, type-aware validation run before a listing goes to review. */
export function submitIssues(d: DraftInput, opts: { terai: boolean; maxPhotos: number; imageCount: number }): SubmitIssue[] {
  const issues: SubmitIssue[] = [];
  const fields = new Set(TYPE_FIELDS[d.type]);
  if (!d.districtId) issues.push("district");
  if (!d.municipalityId) issues.push("municipality");
  if (d.lat == null || d.lng == null) issues.push("pin");
  // Land must have a real area (no "0-0-0-0", fix #21); built property needs plot or built-up area.
  const hasArea = !!d.areaInput && isPositiveArea(d.areaInput);
  if (d.type === "LAND" ? !hasArea : !hasArea && !(d.builtUpAreaSqFt && d.builtUpAreaSqFt > 0)) issues.push("area");
  // A price, or "price on request" — never Rs 0 (fix #16).
  if (!d.priceOnRequest && !(d.priceNpr && d.priceNpr > 0)) issues.push("price");
  if (!d.priceOnRequest && d.priceUnit && !allowedPriceUnits(d.purpose, d.type, opts.terai).includes(d.priceUnit)) issues.push("priceUnit");
  if (fields.has("bedrooms") && ["HOUSE", "BUNGALOW", "FLAT"].includes(d.type) && !(d.bedrooms && d.bedrooms > 0)) issues.push("bedrooms");
  if (!d.contactName || d.contactName.length < 2) issues.push("contactName");
  if (!d.contactPhone || !normalizePhone(d.contactPhone)) issues.push("contactPhone");
  if (d.whatsapp && !normalizePhone(d.whatsapp)) issues.push("whatsapp");
  if (d.viber && !normalizePhone(d.viber)) issues.push("viber");
  if (!d.planSlug) issues.push("plan");
  if ((d.images ?? []).some((i) => i.alt.trim().length < 3)) issues.push("photosAlt");
  if (opts.imageCount > opts.maxPhotos) issues.push("photosTooMany");
  if (d.youtubeUrl && !isYoutubeUrl(d.youtubeUrl)) issues.push("youtube");
  if (d.tourUrl && !isHttpsUrl(d.tourUrl)) issues.push("tour");
  return issues;
}

/** Drop fields that do not apply to the type (no "0 0 0 0" on land, fix #22). */
export function pickTypeFields<T extends Record<string, unknown>>(type: PropertyType, data: T): Partial<T> {
  const allowed = new Set<string>(TYPE_FIELDS[type]);
  const typed = ["facing", "roadWidthFt", "roadType", "mainRoadDistanceM", "floors", "bedrooms", "bathrooms", "kitchens", "livingRooms", "parking", "furnishing", "builtYear", "readyToMove", "ownershipType"];
  return Object.fromEntries(Object.entries(data).filter(([k]) => !typed.includes(k) || allowed.has(k))) as Partial<T>;
}
