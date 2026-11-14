import "server-only";
import { unstable_cache } from "next/cache";
import mongoose from "mongoose";
import { connectDB, trusted } from "@/lib/db";
import { codeFromSlug } from "@/lib/slug";
import { PUBLIC_STATUSES, TIER_RANK, type PropertyType, type Purpose, type Tier } from "@/lib/constants";
import { Amenity, District, Municipality, Property, Province, SlugRedirect, User } from "@/models";
import {
  buildMongoFilter,
  buildSort,
  filtersToQuery,
  landingSlug,
  PAGE_SIZE,
  type Filters,
  type Landing,
  type ResolvedLocation,
} from "./filters";
import { CARD_PROJECTION, toCardDTO, toDetailDTO, type MapPointDTO, type PropertyCardDTO, type PropertyDetailDTO } from "./dto";

/**
 * Read-side queries for public pages. Listing queries run on the native
 * collection (needed for $text, see lib/db.ts); every value in the filter is
 * typed by Zod or converted here to ObjectId/Date, so no user-supplied object
 * reaches the driver.
 */

const { ObjectId } = mongoose.Types;
const oid = (s: string) => new ObjectId(s);
const REVALIDATE = 60;

// ---- Locations --------------------------------------------------------------

export type LocationIndex = {
  provinces: { id: string; slug: string; en: string; ne: string }[];
  districts: { id: string; slug: string; en: string; ne: string; provinceId: string; region: string; center: [number, number] | null }[];
  municipalities: { id: string; slug: string; en: string; ne: string; districtId: string }[];
};

export const getLocationIndex = unstable_cache(
  async (): Promise<LocationIndex> => {
    await connectDB();
    const [p, d, m] = await Promise.all([
      Province.find().sort({ refId: 1 }).lean(),
      District.find().sort({ "name.en": 1 }).lean(),
      Municipality.find().sort({ "name.en": 1 }).select("slug name district").lean(),
    ]);
    return {
      provinces: p.map((x) => ({ id: String(x._id), slug: x.slug, en: x.name.en, ne: x.name.ne })),
      districts: d.map((x) => ({
        id: String(x._id), slug: x.slug, en: x.name.en, ne: x.name.ne, provinceId: String(x.province), region: x.region,
        center: x.center?.length === 2 ? [x.center[0], x.center[1]] : null,
      })),
      municipalities: m.map((x) => ({ id: String(x._id), slug: x.slug, en: x.name.en, ne: x.name.ne, districtId: String(x.district) })),
    };
  },
  ["location-index-v2"],
  { tags: ["locations"], revalidate: 86_400 },
);

export type ResolvedNames = {
  province?: LocationIndex["provinces"][number];
  district?: LocationIndex["districts"][number];
  municipality?: LocationIndex["municipalities"][number];
};

export async function resolveLocation(f: Pick<Filters, "province" | "district" | "municipality">): Promise<{
  ids: ResolvedLocation;
  names: ResolvedNames;
}> {
  const idx = await getLocationIndex();
  const names: ResolvedNames = {};
  if (f.municipality) names.municipality = idx.municipalities.find((m) => m.slug === f.municipality);
  if (f.district) names.district = idx.districts.find((d) => d.slug === f.district);
  if (!names.district && names.municipality) names.district = idx.districts.find((d) => d.id === names.municipality!.districtId);
  if (names.municipality && names.district && names.municipality.districtId !== names.district.id) names.municipality = undefined;
  if (f.province) names.province = idx.provinces.find((p) => p.slug === f.province);
  if (!names.province && names.district) names.province = idx.provinces.find((p) => p.id === names.district!.provinceId);

  // Unknown slug → match nothing (empty results), never "all of Nepal".
  const none = new ObjectId("000000000000000000000000");
  return {
    names,
    ids: {
      municipality: f.municipality ? (names.municipality ? oid(names.municipality.id) : none) : undefined,
      district: f.district ? (names.district ? oid(names.district.id) : none) : undefined,
      province: f.province ? (names.province ? oid(names.province.id) : none) : undefined,
    },
  };
}

// ---- Search -------------------------------------------------------------------

export type SearchResult = {
  items: PropertyCardDTO[];
  total: number;
  page: number;
  pages: number;
  nextCursor: string | null;
};

type CursorValue = { t: "d" | "o" | "n" | "z"; v: string | number | null };

function encodeCursor(vals: unknown[]): string {
  const enc: CursorValue[] = vals.map((v) =>
    v instanceof Date
      ? { t: "d", v: v.toISOString() }
      : v instanceof ObjectId
        ? { t: "o", v: String(v) }
        : v == null
          ? { t: "z", v: null }
          : { t: "n", v: Number(v) },
  );
  return Buffer.from(JSON.stringify(enc)).toString("base64url");
}

function decodeCursor(c: string, n: number): unknown[] | null {
  try {
    const arr = JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as CursorValue[];
    if (!Array.isArray(arr) || arr.length !== n) return null;
    return arr.map((x) => {
      if (x.t === "d" && typeof x.v === "string") return new Date(x.v);
      if (x.t === "o" && typeof x.v === "string" && ObjectId.isValid(x.v)) return new ObjectId(x.v);
      if (x.t === "n" && typeof x.v === "number" && Number.isFinite(x.v)) return x.v;
      if (x.t === "z") return null;
      throw new Error("bad cursor");
    });
  } catch {
    return null;
  }
}

/** Keyset cursors are used where all sort keys are always present. */
const CURSOR_SORTS = new Set(["featured", "newest", "views"]);

async function runSearch(f: Filters, cursor: string | null): Promise<SearchResult> {
  await connectDB();
  const { ids } = await resolveLocation(f);
  const filter = buildMongoFilter(f, ids);
  const sort = buildSort(f);
  const col = Property.collection;
  const keys = Object.keys(sort);

  let query: Record<string, unknown> = filter;
  let skip = (f.page - 1) * PAGE_SIZE;
  const useCursor = !!cursor && CURSOR_SORTS.has(f.sort) && f.status !== "sold";
  if (useCursor) {
    const vals = decodeCursor(cursor!, keys.length);
    if (vals) {
      const or = keys.map((k, i) => {
        const cond: Record<string, unknown> = {};
        for (let j = 0; j < i; j++) cond[keys[j]] = vals[j];
        cond[k] = { [sort[k] === -1 ? "$lt" : "$gt"]: vals[i] };
        return cond;
      });
      query = { $and: [filter, { $or: or }] };
      skip = 0;
    }
  }

  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col.find(query, { projection: { ...CARD_PROJECTION, tierRank: 1, views: 1 }, sort, skip, limit: PAGE_SIZE }).toArray(),
  ]);
  const last = docs[docs.length - 1];
  const nextCursor =
    last && docs.length === PAGE_SIZE && CURSOR_SORTS.has(f.sort) ? encodeCursor(keys.map((k) => (last as Record<string, unknown>)[k])) : null;
  return {
    items: docs.map(toCardDTO),
    total,
    page: f.page,
    pages: Math.max(1, Math.min(Math.ceil(total / PAGE_SIZE), 500)),
    nextCursor,
  };
}

const cachedSearch = unstable_cache(
  async (key: string, f: Filters, cursor: string | null) => {
    void key;
    return runSearch(f, cursor);
  },
  ["property-search-v1"],
  { tags: ["properties"], revalidate: REVALIDATE },
);

export function searchProperties(f: Filters, cursor: string | null = null): Promise<SearchResult> {
  return cachedSearch(`${filtersToQuery(f)}|${cursor ?? ""}`, f, cursor);
}

// ---- Home sections ------------------------------------------------------------

export type HomeSections = Record<"highlight" | "top" | "premium" | "latest" | "sold", PropertyCardDTO[]>;

export const getHomeSections = unstable_cache(
  async (): Promise<HomeSections> => {
    await connectDB();
    const col = Property.collection;
    const byTier = (t: Tier) =>
      col
        .find({ status: "ACTIVE", tierRank: TIER_RANK[t] }, { projection: CARD_PROJECTION, sort: { createdAt: -1 }, limit: 8 })
        .toArray();
    const [highlight, top, premium, latest, sold] = await Promise.all([
      byTier("HIGHLIGHT"),
      byTier("TOP"),
      byTier("PREMIUM"),
      byTier("LATEST"),
      col.find({ status: { $in: ["SOLD", "RENTED"] } }, { projection: CARD_PROJECTION, sort: { soldAt: -1 }, limit: 8 }).toArray(),
    ]);
    return {
      highlight: highlight.map(toCardDTO),
      top: top.map(toCardDTO),
      premium: premium.map(toCardDTO),
      latest: latest.map(toCardDTO),
      sold: sold.map(toCardDTO),
    };
  },
  ["home-sections-v1"],
  { tags: ["properties"], revalidate: REVALIDATE },
);

export const getDistrictCounts = unstable_cache(
  async (limit = 12) => {
    await connectDB();
    const rows = await Property.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { status: "ACTIVE" } },
      { $group: { _id: "$district", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: limit },
    ]);
    const idx = await getLocationIndex();
    return rows
      .map((r) => {
        const d = idx.districts.find((x) => x.id === String(r._id));
        return d ? { slug: d.slug, en: d.en, ne: d.ne, count: r.n } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  },
  ["district-counts-v1"],
  { tags: ["properties"], revalidate: 600 },
);

// ---- Detail -------------------------------------------------------------------

export type SlugResolution =
  | { kind: "ok" }
  | { kind: "redirect"; slug: string }
  | { kind: "gone" }
  | { kind: "missing" };

/** Used by middleware (via /api/internal/slug) to send 301 / 410 before rendering. */
export async function resolvePropertySlug(slug: string): Promise<SlugResolution> {
  await connectDB();
  const p = await Property.findOne({ slug }).select("status").lean();
  if (p) return p.status === "DELETED" ? { kind: "gone" } : { kind: "ok" };

  const r = await SlugRedirect.findOne({ entity: "property", from: slug }).lean();
  if (r) return { kind: "redirect", slug: r.to };

  const code = codeFromSlug(slug);
  if (code) {
    const byCode = await Property.findOne({ code }).select("slug status").lean();
    if (byCode) return byCode.status === "DELETED" ? { kind: "gone" } : { kind: "redirect", slug: byCode.slug };
  }
  return { kind: "missing" };
}

export const getPropertyDetail = (slug: string) =>
  unstable_cache(
    async (): Promise<PropertyDetailDTO | null> => {
      await connectDB();
      const d = await Property.findOne({ slug, status: trusted({ $in: PUBLIC_STATUSES }) }).lean();
      if (!d) return null;
      const [amen, owner] = await Promise.all([
        d.amenities?.length ? Amenity.find({ slug: trusted({ $in: d.amenities }) }).sort({ order: 1 }).lean() : [],
        User.findById(d.owner).select("verified").lean(),
      ]);
      return toDetailDTO(d, {
        amenities: amen.map((a) => ({ slug: a.slug, name: { en: a.name?.en ?? a.slug, ne: a.name?.ne || a.name?.en || a.slug }, icon: a.icon })),
        ownerVerified: !!owner?.verified,
      });
    },
    ["property-detail-v1", slug],
    { tags: ["properties", `property:${slug}`], revalidate: 3600 },
  )();

/** Same district + type, price within ±35% (fallback: same district + type, then district). */
export const getSimilar = (p: Pick<PropertyDetailDTO, "id" | "type" | "purpose" | "districtId" | "priceTotalNpr">) =>
  unstable_cache(
    async (): Promise<PropertyCardDTO[]> => {
      await connectDB();
      const col = Property.collection;
      const base = { status: "ACTIVE", _id: { $ne: oid(p.id) }, district: oid(p.districtId) };
      const opts = { projection: CARD_PROJECTION, sort: { tierRank: -1, createdAt: -1 } as const, limit: 4 };
      const attempts: Record<string, unknown>[] = [
        ...(p.priceTotalNpr
          ? [{ ...base, type: p.type, purpose: p.purpose, priceTotalNpr: { $gte: p.priceTotalNpr * 0.65, $lte: p.priceTotalNpr * 1.35 } }]
          : []),
        { ...base, type: p.type, purpose: p.purpose },
        { ...base, purpose: p.purpose },
      ];
      const seen = new Set<string>();
      const out: PropertyCardDTO[] = [];
      for (const q of attempts) {
        for (const d of await col.find(q, opts).toArray()) {
          if (out.length < 4 && !seen.has(String(d._id))) {
            seen.add(String(d._id));
            out.push(toCardDTO(d));
          }
        }
        if (out.length >= 4) break;
      }
      return out;
    },
    ["similar-v1", p.id],
    { tags: ["properties"], revalidate: 600 },
  )();

// ---- Map, saved, sitemap ------------------------------------------------------

export async function getMapPoints(
  f: Filters,
  bbox: [number, number, number, number] | null,
): Promise<{ points: MapPointDTO[]; truncated: boolean }> {
  await connectDB();
  const { ids } = await resolveLocation(f);
  const filter = buildMongoFilter(f, ids);
  filter.location = bbox
    ? {
        $geoWithin: {
          $geometry: {
            type: "Polygon",
            coordinates: [[[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]]]],
          },
        },
      }
    : { $exists: true };
  const LIMIT = 1000;
  const docs = await Property.collection
    .find(filter, {
      projection: { code: 1, slug: 1, title: 1, location: 1, priceNpr: 1, priceOnRequest: 1, priceUnit: 1, purpose: 1 },
      sort: { tierRank: -1, createdAt: -1 },
      limit: LIMIT + 1,
    })
    .toArray();
  return {
    truncated: docs.length > LIMIT,
    points: docs.slice(0, LIMIT).map((d) => ({
      code: d.code,
      slug: d.slug,
      lng: d.location.coordinates[0],
      lat: d.location.coordinates[1],
      title: { en: d.title?.en ?? "", ne: d.title?.ne || d.title?.en || "" },
      priceNpr: d.priceNpr ?? null,
      priceOnRequest: !!d.priceOnRequest,
      priceUnit: d.priceUnit ?? "TOTAL",
      purpose: d.purpose as Purpose,
    })),
  };
}

export async function getCardsByCodes(codes: string[]): Promise<PropertyCardDTO[]> {
  const clean = codes.filter((c) => /^MSR-\d{6,}$/.test(c)).slice(0, 100);
  if (!clean.length) return [];
  await connectDB();
  const docs = await Property.collection
    .find({ code: { $in: clean }, status: { $in: PUBLIC_STATUSES } }, { projection: CARD_PROJECTION })
    .toArray();
  const order = new Map(clean.map((c, i) => [c, i]));
  return docs.map(toCardDTO).sort((a, b) => (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0));
}

/** type × purpose × district combinations that currently have active listings. */
export const getLandingCombos = unstable_cache(
  async (): Promise<(Landing & { count: number; slug: string })[]> => {
    await connectDB();
    const idx = await getLocationIndex();
    const rows = await Property.aggregate<{ _id: { purpose: Purpose; type: PropertyType; district: mongoose.Types.ObjectId }; n: number }>([
      { $match: { status: "ACTIVE" } },
      { $group: { _id: { purpose: "$purpose", type: "$type", district: "$district" }, n: { $sum: 1 } } },
    ]);
    const typeSlug = (t: PropertyType) => t.toLowerCase() as Landing["type"];
    const purposeSlug = (p: Purpose) => p.toLowerCase() as Landing["purpose"];
    const map = new Map<string, Landing & { count: number; slug: string }>();
    const add = (l: Landing, n: number) => {
      const slug = landingSlug(l);
      const prev = map.get(slug);
      map.set(slug, { ...l, slug, count: (prev?.count ?? 0) + n });
    };
    for (const r of rows) {
      const d = idx.districts.find((x) => x.id === String(r._id.district));
      if (!d) continue;
      add({ type: typeSlug(r._id.type), purpose: purposeSlug(r._id.purpose), district: d.slug }, r.n);
      add({ type: undefined, purpose: purposeSlug(r._id.purpose), district: d.slug }, r.n);
      add({ type: typeSlug(r._id.type), purpose: purposeSlug(r._id.purpose), district: undefined }, r.n);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  },
  ["landing-combos-v1"],
  { tags: ["properties"], revalidate: 3600 },
);

/** Minimal rows for the sitemap (no caching: called once per sitemap request, which is itself cached). */
export async function getSitemapProperties(skip: number, limit: number) {
  await connectDB();
  return Property.collection
    .find(
      { status: { $in: PUBLIC_STATUSES } },
      { projection: { slug: 1, updatedAt: 1, images: { $slice: 3 }, title: 1 }, sort: { _id: 1 }, skip, limit },
    )
    .toArray();
}

export async function countPublicProperties() {
  await connectDB();
  return Property.countDocuments({ status: trusted({ $in: PUBLIC_STATUSES }) });
}

// ---- Home stats -----------------------------------------------------------------

export type HomeStats = { active: number; districts: number; verifiedOwners: number; byType: Record<string, number>; forRent: number };

/** Live counts for the home hero and "Browse by type" tiles. */
export const getHomeStats = unstable_cache(
  async (): Promise<HomeStats> => {
    await connectDB();
    const [types, districts, rent, verified] = await Promise.all([
      Property.aggregate<{ _id: string; n: number }>([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$type", n: { $sum: 1 } } }]),
      Property.distinct("district", { status: "ACTIVE" }),
      Property.countDocuments({ status: "ACTIVE", purpose: "RENT" }),
      User.countDocuments({ verified: true }),
    ]);
    const byType = Object.fromEntries(types.map((t) => [t._id, t.n]));
    return { active: types.reduce((a, t) => a + t.n, 0), districts: districts.length, verifiedOwners: verified, byType, forRent: rent };
  },
  ["home-stats-v1"],
  { tags: ["properties"], revalidate: 600 },
);
