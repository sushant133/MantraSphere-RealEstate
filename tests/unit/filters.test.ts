import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  buildMongoFilter,
  buildSort,
  filtersToQuery,
  landingFor,
  landingSlug,
  parseFilters,
  parseLandingSlug,
} from "@/lib/properties/filters";
import { computeTotalPrice } from "@/lib/price";
import imageLoader from "@/lib/image-loader";

describe("parseFilters", () => {
  it("parses valid params and applies defaults", () => {
    const f = parseFilters({ purpose: "sale", type: "land", district: "bhaktapur", min: "5000000", page: "2" });
    expect(f).toMatchObject({ purpose: "sale", type: "land", district: "bhaktapur", min: 5_000_000, page: 2, sort: "featured", view: "grid" });
  });
  it("drops garbage instead of throwing", () => {
    const f = parseFilters({ purpose: "steal", type: "castle", min: "abc", page: "-4", sort: "random", district: "../etc", beds: "99" });
    expect(f.purpose).toBeUndefined();
    expect(f.type).toBeUndefined();
    expect(f.min).toBeUndefined();
    expect(f.page).toBe(1);
    expect(f.sort).toBe("featured");
    expect(f.district).toBeUndefined();
    expect(f.beds).toBeUndefined();
  });
  it("ignores operator-looking keys and arrays", () => {
    const f = parseFilters({ $where: "1", purpose: ["rent", "sale"] });
    expect(f.purpose).toBe("rent");
    expect(Object.keys(f)).not.toContain("$where");
  });
  it("swaps inverted ranges and caps pages", () => {
    const f = parseFilters({ min: "9000000", max: "1000000", page: "9999" });
    expect([f.min, f.max]).toEqual([1_000_000, 9_000_000]);
    expect(f.page).toBe(1);
  });
});

describe("buildMongoFilter", () => {
  it("builds typed conditions", () => {
    const f = parseFilters({ purpose: "rent", type: "flat", beds: "2", min: "10000", max: "30000", amin: "4", aunit: "aana", parking: "1" });
    const q = buildMongoFilter(f, {});
    expect(q).toMatchObject({
      status: "ACTIVE",
      purpose: "RENT",
      type: "FLAT",
      bedrooms: { $gte: 2 },
      priceTotalNpr: { $gte: 10000, $lte: 30000 },
      areaSqFt: { $gte: 1369 },
      parking: { $gte: 1 },
    });
  });
  it("handles sold, price-on-request, tier and text", () => {
    expect(buildMongoFilter(parseFilters({ status: "sold" }), {}).status).toEqual({ $in: ["SOLD", "RENTED"] });
    expect(buildMongoFilter(parseFilters({ por: "only" }), {}).priceOnRequest).toBe(true);
    expect(buildMongoFilter(parseFilters({ tier: "top" }), {}).tierRank).toBe(30);
    expect(buildMongoFilter(parseFilters({ q: "bhaktpur" }), {}).$text).toEqual({ $search: "bhaktpur" });
  });
  it("prefers the most specific location", () => {
    const q = buildMongoFilter(parseFilters({}), { district: "D", municipality: "M" });
    expect(q.municipality).toBe("M");
    expect(q.district).toBeUndefined();
  });
  it("sorts price on-request listings last", () => {
    expect(Object.keys(buildSort(parseFilters({ sort: "price_asc" })))).toEqual(["priceOnRequest", "priceTotalNpr", "_id"]);
  });
});

describe("query strings and landing pages", () => {
  it("canonicalises query order and omits defaults", () => {
    const f = parseFilters({ page: "1", view: "grid", district: "kathmandu", purpose: "sale" });
    expect(filtersToQuery(f)).toBe("purpose=sale&district=kathmandu");
    expect(filtersToQuery(f, { page: 3 })).toBe("purpose=sale&district=kathmandu&page=3");
  });
  it("parses and builds landing slugs", () => {
    expect(parseLandingSlug("land-for-sale-in-bhaktapur")).toEqual({ type: "land", purpose: "sale", district: "bhaktapur" });
    expect(parseLandingSlug("commercial-space-for-rent-in-kathmandu")).toEqual({ type: "commercial", purpose: "rent", district: "kathmandu" });
    expect(parseLandingSlug("property-for-sale-in-nepal")).toEqual({ type: undefined, purpose: "sale", district: undefined });
    expect(parseLandingSlug("castle-for-sale-in-kathmandu")).toBeNull();
    expect(landingSlug({ type: "house", purpose: "rent", district: "lalitpur" })).toBe("house-for-rent-in-lalitpur");
    expect(landingSlug({ type: "office", purpose: "rent" })).toBe("office-space-for-rent-in-nepal");
  });
  it("only simple filter sets are landing pages", () => {
    expect(landingFor(parseFilters({ purpose: "sale", type: "land", district: "bhaktapur" }))).toEqual({ purpose: "sale", type: "land", district: "bhaktapur" });
    expect(landingFor(parseFilters({ purpose: "sale", beds: "3" }))).toBeNull();
    expect(landingFor(parseFilters({ type: "land" }))).toBeNull();
    expect(activeFilterCount(parseFilters({ purpose: "sale", beds: "3", sort: "newest" }))).toBe(2);
  });
});

describe("computeTotalPrice", () => {
  it("multiplies per-unit land prices by area", () => {
    expect(computeTotalPrice({ priceNpr: 2_000_000, priceUnit: "PER_AANA", areaSqFt: 342.25 * 8 })).toBe(16_000_000);
    expect(computeTotalPrice({ priceNpr: 5_000_000, priceUnit: "PER_KATTHA", areaSqFt: 3645 * 2 })).toBe(10_000_000);
    expect(computeTotalPrice({ priceNpr: 25_000, priceUnit: "PER_MONTH" })).toBe(25_000);
    expect(computeTotalPrice({ priceNpr: 1, priceOnRequest: true })).toBeNull();
  });
});

describe("image loader", () => {
  it("maps widths to pre-built variants", () => {
    expect(imageLoader({ src: "/uploads/demo/house-1-1600.webp", width: 360 })).toBe("/uploads/demo/house-1-400.webp");
    expect(imageLoader({ src: "/uploads/demo/house-1-1600.webp", width: 768 })).toBe("/uploads/demo/house-1-800.webp");
    expect(imageLoader({ src: "/uploads/demo/house-1-400.webp", width: 1920 })).toBe("/uploads/demo/house-1-1600.webp");
    expect(imageLoader({ src: "/logo.svg", width: 64 })).toBe("/logo.svg");
  });
});
