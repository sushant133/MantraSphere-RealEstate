import { z } from "zod";
import { FACINGS, FURNISHINGS, TIER_RANK, type PropertyType, type Purpose, type Tier } from "@/lib/constants";
import { SQFT } from "@/lib/units";

/**
 * All search/filter state lives in URL query params (fix #10). This module
 * parses them (unknown or malformed values are dropped, never a 500) and
 * converts them to a MongoDB filter. Pure functions: unit-tested.
 */

export const TYPE_SLUGS = {
  house: "HOUSE",
  land: "LAND",
  flat: "FLAT",
  bungalow: "BUNGALOW",
  commercial: "COMMERCIAL",
  office: "OFFICE",
  shop: "SHOP",
} as const satisfies Record<string, PropertyType>;
export type TypeSlug = keyof typeof TYPE_SLUGS;

export const PURPOSE_SLUGS = { sale: "SALE", rent: "RENT", lease: "LEASE" } as const satisfies Record<string, Purpose>;
export type PurposeSlug = keyof typeof PURPOSE_SLUGS;

export const TIER_SLUGS = { highlight: "HIGHLIGHT", top: "TOP", premium: "PREMIUM", latest: "LATEST" } as const satisfies Record<
  string,
  Tier
>;

export const FACING_SLUGS = Object.fromEntries(FACINGS.map((f) => [f.toLowerCase().replace("_", "-"), f])) as Record<
  string,
  (typeof FACINGS)[number]
>;
export const FURNISHING_SLUGS = { unfurnished: "UNFURNISHED", semi: "SEMI_FURNISHED", full: "FULLY_FURNISHED" } as const satisfies Record<
  string,
  (typeof FURNISHINGS)[number]
>;

export const AREA_UNITS = { aana: SQFT.AANA, ropani: SQFT.ROPANI, kattha: SQFT.KATTHA, bigha: SQFT.BIGHA, dhur: SQFT.DHUR, sqft: 1, sqm: SQFT.SQM } as const;
export type AreaUnit = keyof typeof AREA_UNITS;

export const SORTS = ["featured", "newest", "price_asc", "price_desc", "area_asc", "area_desc", "views"] as const;
export type Sort = (typeof SORTS)[number];
export const VIEWS = ["grid", "list", "map"] as const;
export const POSTED_WITHIN = ["1", "7", "30", "90"] as const;

export const PAGE_SIZE = 20;
export const MAX_PAGE = 500;

const opt = <T extends z.ZodTypeAny>(s: T) => s.optional().catch(undefined);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const keysOf = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const filtersSchema = z.object({
  q: opt(z.string().trim().min(1).max(100)),
  purpose: opt(z.enum(keysOf(PURPOSE_SLUGS))),
  type: opt(z.enum(keysOf(TYPE_SLUGS))),
  province: opt(slug),
  district: opt(slug),
  municipality: opt(slug),
  min: opt(z.coerce.number().int().min(0).max(9e15)),
  max: opt(z.coerce.number().int().min(0).max(9e15)),
  amin: opt(z.coerce.number().min(0).max(1e7)),
  amax: opt(z.coerce.number().min(0).max(1e7)),
  aunit: opt(z.enum(keysOf(AREA_UNITS))),
  beds: opt(z.coerce.number().int().min(1).max(10)),
  baths: opt(z.coerce.number().int().min(1).max(10)),
  facing: opt(z.enum(keysOf(FACING_SLUGS))),
  road: opt(z.coerce.number().int().min(1).max(200)),
  mrd: opt(z.coerce.number().int().min(1).max(100_000)),
  furnishing: opt(z.enum(keysOf(FURNISHING_SLUGS))),
  parking: opt(z.literal("1")),
  por: opt(z.enum(["only", "exclude"])),
  within: opt(z.enum(POSTED_WITHIN)),
  tier: opt(z.enum(keysOf(TIER_SLUGS))),
  status: opt(z.literal("sold")),
  sort: z.enum(SORTS).catch("featured").default("featured"),
  view: z.enum(VIEWS).catch("grid").default("grid"),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1).default(1),
});
export type Filters = z.infer<typeof filtersSchema>;

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseFilters(raw: RawParams): Filters {
  const obj: Record<string, string> = {};
  const entries = raw instanceof URLSearchParams ? [...raw.entries()] : Object.entries(raw);
  for (const [k, v] of entries) {
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === "string" && val !== "" && !k.startsWith("$")) obj[k] = val;
  }
  const f = filtersSchema.parse(obj);
  // Swap an inverted range instead of returning nothing.
  if (f.min != null && f.max != null && f.min > f.max) [f.min, f.max] = [f.max, f.min];
  if (f.amin != null && f.amax != null && f.amin > f.amax) [f.amin, f.amax] = [f.amax, f.amin];
  return f;
}

/** Canonical query string: stable key order, defaults omitted. */
export function filtersToQuery(f: Partial<Filters>, overrides: Partial<Filters> = {}): string {
  const merged = { ...f, ...overrides } as Record<string, unknown>;
  const defaults: Record<string, unknown> = { sort: "featured", view: "grid", page: 1 };
  const keys = Object.keys(filtersSchema.shape);
  const p = new URLSearchParams();
  for (const k of keys) {
    const v = merged[k];
    if (v == null || v === "" || defaults[k] === v) continue;
    p.set(k, String(v));
  }
  return p.toString();
}

/** Number of active filters (for the "Filters (3)" badge). */
export function activeFilterCount(f: Filters): number {
  const ignore = new Set(["sort", "view", "page", "q"]);
  return Object.entries(f).filter(([k, v]) => !ignore.has(k) && v != null).length;
}

// ---- Mongo filter -----------------------------------------------------------

export type ResolvedLocation = { province?: unknown; district?: unknown; municipality?: unknown };

/**
 * Build a MongoDB filter from parsed filters. Every value is typed by Zod
 * (enum, number or resolved ObjectId) so no user-controlled object can reach
 * the query. Location slugs must be resolved to ids by the caller.
 */
export function buildMongoFilter(f: Filters, loc: ResolvedLocation, now = new Date()): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  q.status = f.status === "sold" ? { $in: ["SOLD", "RENTED"] } : "ACTIVE";
  if (f.purpose) q.purpose = PURPOSE_SLUGS[f.purpose];
  if (f.type) q.type = TYPE_SLUGS[f.type];
  if (loc.municipality) q.municipality = loc.municipality;
  else if (loc.district) q.district = loc.district;
  else if (loc.province) q.province = loc.province;
  if (f.tier) q.tierRank = TIER_RANK[TIER_SLUGS[f.tier]]; // tierRank hits the {status, tierRank, createdAt} index

  if (f.por === "only") q.priceOnRequest = true;
  else if (f.min != null || f.max != null) {
    q.priceTotalNpr = { ...(f.min != null ? { $gte: f.min } : {}), ...(f.max != null ? { $lte: f.max } : {}) };
  } else if (f.por === "exclude") q.priceOnRequest = false;

  if (f.amin != null || f.amax != null) {
    const unit = AREA_UNITS[f.aunit ?? "sqft"];
    q.areaSqFt = {
      ...(f.amin != null ? { $gte: Math.floor(f.amin * unit) } : {}),
      ...(f.amax != null ? { $lte: Math.ceil(f.amax * unit) } : {}),
    };
  }
  if (f.beds) q.bedrooms = { $gte: f.beds };
  if (f.baths) q.bathrooms = { $gte: f.baths };
  if (f.facing) q.facing = FACING_SLUGS[f.facing];
  if (f.road) q.roadWidthFt = { $gte: f.road };
  if (f.mrd) q.mainRoadDistanceM = { $lte: f.mrd };
  if (f.furnishing) q.furnishing = FURNISHING_SLUGS[f.furnishing];
  if (f.parking) q.parking = { $gte: 1 };
  if (f.within) q.createdAt = { $gte: new Date(now.getTime() - Number(f.within) * 86_400_000) };
  if (f.q) q.$text = { $search: f.q };
  return q;
}

export function buildSort(f: Filters): Record<string, 1 | -1> {
  switch (f.sort) {
    case "newest":
      return { createdAt: -1, _id: -1 };
    case "price_asc":
      return { priceOnRequest: 1, priceTotalNpr: 1, _id: 1 };
    case "price_desc":
      return { priceOnRequest: 1, priceTotalNpr: -1, _id: -1 };
    case "area_asc":
      return { areaSqFt: 1, _id: 1 };
    case "area_desc":
      return { areaSqFt: -1, _id: -1 };
    case "views":
      return { views: -1, _id: -1 };
    default:
      return f.status === "sold" ? { soldAt: -1, _id: -1 } : { tierRank: -1, createdAt: -1, _id: -1 };
  }
}

// ---- SEO landing pages ------------------------------------------------------

/** Landing slugs use readable type names: `commercial-space-for-rent-in-kathmandu`. */
export const LANDING_TYPE = {
  property: undefined,
  house: "house",
  land: "land",
  flat: "flat",
  bungalow: "bungalow",
  "commercial-space": "commercial",
  "office-space": "office",
  shop: "shop",
} as const satisfies Record<string, TypeSlug | undefined>;
export type LandingTypeSlug = keyof typeof LANDING_TYPE;

export type Landing = { type?: TypeSlug; purpose: PurposeSlug; district?: string };

const LANDING_RE = new RegExp(
  `^(${Object.keys(LANDING_TYPE).join("|")})-for-(sale|rent|lease)-in-([a-z0-9]+(?:-[a-z0-9]+)*)$`,
);

export function parseLandingSlug(s: string): Landing | null {
  const m = s.match(LANDING_RE);
  if (!m) return null;
  const type = LANDING_TYPE[m[1] as LandingTypeSlug];
  return { type, purpose: m[2] as PurposeSlug, district: m[3] === "nepal" ? undefined : m[3] };
}

export function landingSlug(l: Landing): string {
  const t = (Object.entries(LANDING_TYPE).find(([, v]) => v === l.type)?.[0] ?? "property") as LandingTypeSlug;
  return `${t}-for-${l.purpose}-in-${l.district ?? "nepal"}`;
}

/**
 * A filter set is a landing page when it has a purpose and only type/district
 * on top (plus page). Such pages canonicalise to the landing URL; any other
 * combination is `noindex, follow` to avoid crawl bloat.
 */
export function landingFor(f: Filters): Landing | null {
  if (!f.purpose) return null;
  const extra = Object.entries(f).filter(
    ([k, v]) => v != null && !["purpose", "type", "district", "page", "view", "sort"].includes(k),
  );
  if (extra.length || f.sort !== "featured" || f.view !== "grid") return null;
  return { type: f.type, purpose: f.purpose, district: f.district };
}
