import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, IMPORT_EXAMPLE, mapRow, parseArea, parseCsv, type Lookup } from "@/lib/admin/import-map";
import { getResource, schemaFor } from "@/lib/admin/resources";

// csvCell lives in a server-only module; mirror its contract here.
const csvCell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const lk: Lookup = {
  district: (n) => (/^(bhaktapur|भक्तपुर)$/i.test(n) ? { id: "d".repeat(24), terai: false } : /^siraha$/i.test(n) ? { id: "e".repeat(24), terai: true } : null),
  municipality: (did, n) => (did === "d".repeat(24) && /^suryabinayak$/i.test(n) ? { id: "a".repeat(24), wards: 10 } : did === "e".repeat(24) && /^lahan$/i.test(n) ? { id: "b".repeat(24), wards: 24 } : null),
  planExists: (s) => ["normal", "premium"].includes(s),
};

describe("parseArea", () => {
  it("reads traditional and metric formats", () => {
    expect(parseArea("1-4-0-0", "ropani")).toEqual({ system: "RAPD", values: { ropani: 1, aana: 4, paisa: 0, daam: 0 } });
    expect(parseArea("8", "aana")).toEqual({ system: "RAPD", values: { ropani: 0, aana: 8, paisa: 0, daam: 0 } });
    expect(parseArea("०-५-०", "bigha")).toEqual({ system: "BKD", values: { bigha: 0, kattha: 5, dhur: 0 } });
    expect(parseArea("1200", "sqft")).toEqual({ system: "SQFT", values: { sqft: 1200 } });
    expect(parseArea("110", "sqm")).toEqual({ system: "SQM", values: { sqm: 110 } });
    expect(parseArea("abc", "")).toBeNull();
  });
});

describe("mapRow", () => {
  it("accepts the template example as publishable", () => {
    const r = mapRow(2, IMPORT_EXAMPLE, lk);
    expect(r.errors).toEqual([]);
    expect(r.issues).toEqual([]);
    expect(r.publish).toBe(true);
    expect(r.draft).toMatchObject({ purpose: "SALE", type: "LAND", priceNpr: 25_000_000, priceUnit: "TOTAL", facing: "EAST", roadType: "BLACKTOPPED" });
  });
  it("reports readable errors per column", () => {
    const r = mapRow(3, { ...IMPORT_EXAMPLE, district: "Atlantis", price: "a lot", ward: "3.5", plan: "gold", facing: "up" }, lk);
    expect(r.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("district: “Atlantis” not found"),
        expect.stringContaining("price: “a lot”"),
        expect.stringContaining("ward:"),
        expect.stringContaining("plan: “gold”"),
        expect.stringContaining("facing:"),
      ]),
    );
  });
  it("checks ward range, Nepali names and rent units", () => {
    expect(mapRow(4, { ...IMPORT_EXAMPLE, district: "भक्तपुर", ward: "12" }, lk).errors).toEqual([expect.stringContaining("outside 1–10")]);
    const rent = mapRow(5, { ...IMPORT_EXAMPLE, purpose: "rent", type: "house", district: "Siraha", municipality: "Lahan", area: "0-3-0", area_unit: "bigha", price: "25000", price_unit: "", bedrooms: "3" }, lk);
    expect(rent.errors).toEqual([]);
    expect(rent.draft?.priceUnit).toBe("PER_MONTH");
  });
  it("flags incomplete rows as drafts rather than errors", () => {
    const r = mapRow(6, { ...IMPORT_EXAMPLE, lat: "", lng: "" }, lk);
    expect(r.errors).toEqual([]);
    expect(r.issues).toContain("pin");
  });
  it("rejects rows without purpose/type", () => {
    expect(mapRow(7, { district: "Bhaktapur" }, lk).errors).toEqual(["purpose is required", "type is required"]);
  });
});

describe("parseCsv", () => {
  it("handles quotes, commas, CRLF and BOM", () => {
    const csv = '﻿purpose,description_en\r\nsale,"Big, ""quiet"" plot"\r\nrent,"Line 1\nLine 2"\r\n';
    expect(parseCsv(csv)).toEqual([
      { purpose: "sale", description_en: 'Big, "quiet" plot' },
      { purpose: "rent", description_en: "Line 1\nLine 2" },
    ]);
  });
  it("round-trips the template header", () => {
    const rows = parseCsv([IMPORT_COLUMNS.join(","), IMPORT_COLUMNS.map((c) => csvCell(IMPORT_EXAMPLE[c])).join(",")].join("\n"));
    expect(rows[0].price).toBe("2.5 crore");
  });
});

describe("csv injection guard", () => {
  it("neutralises formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+9779812345678")).toBe(`"'+9779812345678"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
  });
});

describe("resource schemas", () => {
  it("validates plan input", () => {
    const s = schemaFor(getResource("plans")!);
    const ok = {
      slug: "gold", name: { en: "Gold", ne: "" }, tier: "TOP", priceNpr: 20000, durationDays: null, homepageSection: null, facebookPromotionDays: 5,
      videoIncluded: false, maxPhotos: 20, sortWeight: 0, features: { en: ["A"], ne: [] }, active: true,
    };
    expect(s.safeParse(ok).success).toBe(true);
    expect(s.safeParse({ ...ok, slug: "Gold Plan" }).success).toBe(false);
    expect(s.safeParse({ ...ok, priceNpr: 10.5 }).success).toBe(false);
  });
  it("only accepts CMS-uploaded images", () => {
    const s = schemaFor(getResource("banners")!);
    const base = { title: { en: "Sale", ne: "" }, href: "/en/properties", placement: "HOME_HERO", startsAt: null, endsAt: null, order: 0, active: true };
    expect(s.safeParse({ ...base, image: { url: "/uploads/cms/abc123.webp", alt: "x", width: 10, height: 10 } }).success).toBe(true);
    expect(s.safeParse({ ...base, image: { url: "https://evil.example/x.webp", alt: "x", width: 10, height: 10 } }).success).toBe(false);
    expect(s.safeParse({ ...base, image: null, href: "javascript:alert(1)" }).success).toBe(false);
  });
});
