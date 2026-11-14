import { describe, expect, it } from "vitest";
import { findConflicts } from "@/lib/properties/conflicts";
import { allowedPriceUnits, draftSchema, pickTypeFields, submitIssues, type DraftInput } from "@/lib/properties/listing-schema";

describe("findConflicts (fix #24)", () => {
  it("flags road distance that contradicts the field", () => {
    const c = findConflicts("Lovely land only 100 m from the main road with 13 ft road access.", { mainRoadDistanceM: 10, roadWidthFt: 13 });
    expect(c).toEqual([{ field: "mainRoadDistanceM", found: 100, expected: 10 }]);
  });
  it("checks rooms, floors and Nepali text with Devanagari digits", () => {
    const c = findConflicts("३ शयनकक्ष, २ बाथरुम, २.५ तला", { bedrooms: 4, bathrooms: 2, floors: 2.5 });
    expect(c).toEqual([{ field: "bedrooms", found: 3, expected: 4 }]);
  });
  it("understands land units and remainders", () => {
    const area = { system: "RAPD" as const, values: { ropani: 1, aana: 4, paisa: 0, daam: 0 } };
    expect(findConflicts("1 ropani 4 aana land", { areaInput: area })).toEqual([]);
    expect(findConflicts("20 aana plot", { areaInput: area })).toEqual([]);
    expect(findConflicts("8 aana plot", { areaInput: area })).toEqual([{ field: "area", found: 8, expected: 20 }]);
  });
  it("ignores fields that are not set", () => {
    expect(findConflicts("5 bedrooms", {})).toEqual([]);
  });
});

const base: DraftInput = {
  purpose: "SALE",
  type: "LAND",
  districtId: "a".repeat(24),
  municipalityId: "b".repeat(24),
  lat: 27.7,
  lng: 85.3,
  areaInput: { system: "RAPD", values: { ropani: 0, aana: 8, paisa: 0, daam: 0 } },
  priceOnRequest: false,
  priceNpr: 25_000_000,
  priceUnit: "TOTAL",
  contactName: "Ram Shrestha",
  contactPhone: "9841234567",
  planSlug: "normal",
  images: [{ id: "c".repeat(24), alt: "Land in Bhaktapur", isCover: true }],
};

describe("submitIssues", () => {
  const opts = { terai: false, maxPhotos: 10, imageCount: 1 };
  it("accepts a complete land listing", () => {
    expect(submitIssues(base, opts)).toEqual([]);
  });
  it("rejects zero land area and missing price (fixes #16, #21)", () => {
    const d = { ...base, areaInput: { system: "RAPD" as const, values: { ropani: 0, aana: 0, paisa: 0, daam: 0 } }, priceNpr: null };
    expect(submitIssues(d, opts)).toEqual(expect.arrayContaining(["area", "price"]));
    expect(submitIssues({ ...d, priceOnRequest: true }, opts)).not.toContain("price");
  });
  it("requires bedrooms for homes, a pin, a plan and a valid phone", () => {
    const d = { ...base, type: "HOUSE" as const, lat: null, planSlug: null, contactPhone: "12345", bedrooms: null };
    expect(submitIssues(d, opts)).toEqual(expect.arrayContaining(["bedrooms", "pin", "plan", "contactPhone"]));
  });
  it("enforces plan photo limits and alt text", () => {
    expect(submitIssues({ ...base, images: [{ id: "c".repeat(24), alt: "", isCover: true }] }, opts)).toContain("photosAlt");
    expect(submitIssues(base, { ...opts, imageCount: 11 })).toContain("photosTooMany");
  });
  it("rent is always per month (fix #17)", () => {
    expect(allowedPriceUnits("RENT", "HOUSE", false)).toEqual(["PER_MONTH"]);
    expect(allowedPriceUnits("SALE", "LAND", true)).toContain("PER_KATTHA");
    expect(submitIssues({ ...base, purpose: "RENT", priceUnit: "TOTAL" }, opts)).toContain("priceUnit");
  });
});

describe("draftSchema / pickTypeFields", () => {
  it("accepts partial drafts but rejects bad values", () => {
    expect(draftSchema.safeParse({ purpose: "SALE", type: "LAND" }).success).toBe(true);
    expect(draftSchema.safeParse({ purpose: "SALE", type: "LAND", lat: 40 }).success).toBe(false);
    expect(draftSchema.safeParse({ purpose: "SALE", type: "LAND", areaInput: { system: "RAPD", values: { ropani: 1, aana: 16, paisa: 0, daam: 0 } } }).success).toBe(false);
  });
  it("drops room counts on land (fix #22)", () => {
    expect(pickTypeFields("LAND", { bedrooms: 0, bathrooms: 0, facing: "EAST", address: "x" })).toEqual({ facing: "EAST", address: "x" });
  });
});
