import { describe, expect, it } from "vitest";
import {
  formatPriceCompact,
  formatPriceFull,
  formatPriceWords,
  groupNepali,
  isPriceOutlier,
  parsePrice,
  toDevanagariDigits,
} from "@/lib/price";

describe("groupNepali", () => {
  it("uses lakh/crore grouping", () => {
    expect(groupNepali(21000000)).toBe("2,10,00,000");
    expect(groupNepali(4500000)).toBe("45,00,000");
    expect(groupNepali(100000)).toBe("1,00,000");
    expect(groupNepali(999)).toBe("999");
    expect(groupNepali(1000)).toBe("1,000");
  });
});

describe("formatPriceWords", () => {
  it("formats crore + lakh in English and Nepali", () => {
    expect(formatPriceWords(21000000, "en")).toBe("Rs 2 Crore 10 Lakh");
    expect(formatPriceWords(21000000, "ne")).toBe("रु २ करोड १० लाख");
  });
  it("handles thousands and remainders", () => {
    expect(formatPriceWords(4550000, "en")).toBe("Rs 45 Lakh 50 Thousand");
    expect(formatPriceWords(25000, "en")).toBe("Rs 25 Thousand");
    expect(formatPriceWords(10000000, "en")).toBe("Rs 1 Crore");
  });
});

describe("formatPriceCompact", () => {
  it("abbreviates", () => {
    expect(formatPriceCompact(21000000, "en")).toBe("Rs 2.1 Cr");
    expect(formatPriceCompact(4500000, "en")).toBe("Rs 45 Lakh");
    expect(formatPriceCompact(25000, "en")).toBe("Rs 25,000");
    expect(formatPriceCompact(21000000, "ne")).toBe("रु २.१ करोड");
  });
  it("full amount", () => {
    expect(formatPriceFull(21000000, "en")).toBe("Rs 2,10,00,000");
    expect(toDevanagariDigits("2,10")).toBe("२,१०");
  });
});

describe("parsePrice", () => {
  it("parses common formats", () => {
    expect(parsePrice("2.1 crore")).toBe(21000000);
    expect(parsePrice("45 lakh")).toBe(4500000);
    expect(parsePrice("Rs. 2,10,00,000")).toBe(21000000);
    expect(parsePrice("रु ४५ लाख")).toBe(4500000);
    expect(parsePrice("abc")).toBeNull();
  });
});

describe("isPriceOutlier", () => {
  it("flags impossible values", () => {
    expect(isPriceOutlier("SALE", 500_000_000)).toBe(false); // 50 Cr is plausible
    expect(isPriceOutlier("SALE", 4_500_000_000)).toBe(true); // 450 Cr → needs admin approval
    expect(isPriceOutlier("SALE", 1)).toBe(true);
    expect(isPriceOutlier("RENT", 25_000)).toBe(false);
  });
});
