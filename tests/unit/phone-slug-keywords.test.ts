import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, normalizePhone, whatsappHref } from "@/lib/phone";
import { codeFromSlug, propertySlug, slugify } from "@/lib/slug";
import { buildSearchKeywords } from "@/lib/search-keywords";
import { generateTitle } from "@/lib/titles";
import { formatPropertyCode } from "@/lib/counters";
import { hasUnsafeKeys } from "@/lib/sanitize";

describe("normalizePhone", () => {
  it("normalises Nepali mobiles to E.164", () => {
    expect(normalizePhone("9849361011")).toEqual({ e164: "+9779849361011", kind: "MOBILE" });
    expect(normalizePhone("+977 984-936-1011")?.e164).toBe("+9779849361011");
    expect(normalizePhone("977 9824763981")?.e164).toBe("+9779824763981");
    expect(normalizePhone("९८४९३६१०११")?.e164).toBe("+9779849361011");
  });
  it("strips invisible characters", () => {
    expect(normalizePhone("​98493‌61011﻿")?.e164).toBe("+9779849361011");
  });
  it("normalises landlines", () => {
    expect(normalizePhone("01-4621206")).toEqual({ e164: "+97714621206", kind: "LANDLINE" });
    expect(normalizePhone("+977-1-4621206")?.e164).toBe("+97714621206");
  });
  it("rejects malformed numbers (9 or 11 digit mobiles)", () => {
    expect(normalizePhone("984936101")).toBeNull();
    expect(normalizePhone("98493610111")).toBeNull();
    expect(normalizePhone("9549361011")).toBeNull();
  });
  it("only accepts foreign numbers with an explicit country code", () => {
    expect(normalizePhone("+61 412 345 678")).toBeNull();
    expect(normalizePhone("0412 345 678", { countryCode: "+61" })?.e164).toBe("+61412345678");
  });
  it("builds links and display strings", () => {
    expect(whatsappHref("+9779849361011", "Hi MSR-000001")).toBe("https://wa.me/9779849361011?text=Hi%20MSR-000001");
    expect(formatPhoneDisplay("+9779849361011")).toBe("+977 984-9361011");
    expect(formatPhoneDisplay("+97714621206")).toBe("+977 1-4621206");
  });
});

describe("slugs", () => {
  it("never leaves leading/trailing hyphens", () => {
    expect(slugify("  Bunglow  for sale!! - ")).toBe("bunglow-for-sale");
    expect(propertySlug("4BHK House for Sale in Ramkot, Kathmandu", "MSR-000123")).toBe(
      "4bhk-house-for-sale-in-ramkot-kathmandu-msr-000123",
    );
    expect(codeFromSlug("4bhk-house-for-sale-msr-000123")).toBe("MSR-000123");
  });
  it("formats codes", () => {
    expect(formatPropertyCode(123)).toBe("MSR-000123");
  });
});

describe("search keywords", () => {
  it("includes romanisation variants and Nepali", () => {
    const k = buildSearchKeywords(["Bhaktapur", "भक्तपुर", "Suryabinayak"]);
    expect(k).toContain("bhaktapur");
    expect(k).toContain("bhaktpur");
    expect(k).toContain("भक्तपुर");
    expect(k).toContain("suryabinayak");
  });
});

describe("titles", () => {
  const base = { district: { en: "Kathmandu", ne: "काठमाडौँ" }, place: { en: "Ramkot", ne: "रामकोट" } };
  it("generates from structured data", () => {
    expect(generateTitle({ ...base, purpose: "SALE", type: "HOUSE", bedrooms: 4 }, "en")).toBe(
      "4BHK House for Sale in Ramkot, Kathmandu",
    );
    expect(generateTitle({ ...base, purpose: "RENT", type: "LAND", bedrooms: 3, area: "8 Aana" }, "en")).toBe(
      "8 Aana Land for Rent in Ramkot, Kathmandu",
    );
    expect(generateTitle({ ...base, purpose: "SALE", type: "HOUSE", bedrooms: 4 }, "ne")).toBe(
      "रामकोट, काठमाडौँमा 4BHK घर बिक्रीमा",
    );
  });
});

describe("sanitize", () => {
  it("rejects operator keys", () => {
    expect(hasUnsafeKeys({ a: { $gt: "" } })).toBe(true);
    expect(hasUnsafeKeys({ "a.b": 1 })).toBe(true);
    expect(hasUnsafeKeys({ a: [{ b: 1 }] })).toBe(false);
  });
});
