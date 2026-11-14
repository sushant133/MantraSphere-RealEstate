import { describe, expect, it } from "vitest";
import {
  SQFT,
  formatAreaInput,
  formatConverted,
  isPositiveArea,
  rapdNotation,
  sqFtIn,
  sqFtToBkd,
  sqFtToRapd,
  sqFtToSqm,
  toSqFt,
} from "@/lib/units";

describe("unit constants", () => {
  it("hill system is internally consistent", () => {
    expect(SQFT.AANA * 16).toBe(SQFT.ROPANI);
    expect(SQFT.PAISA * 4).toBe(SQFT.AANA);
    expect(SQFT.DAAM * 4).toBe(SQFT.PAISA);
    expect(SQFT.ROPANI).toBe(5476);
    expect(SQFT.DAAM).toBe(21.390625);
  });
  it("terai system is internally consistent", () => {
    expect(SQFT.KATTHA * 20).toBe(SQFT.BIGHA);
    expect(SQFT.DHUR * 20).toBe(SQFT.KATTHA);
    expect(SQFT.BIGHA).toBe(72900);
  });
});

describe("toSqFt", () => {
  it("converts Ropani-Aana-Paisa-Daam", () => {
    expect(toSqFt({ system: "RAPD", values: { ropani: 1, aana: 0, paisa: 0, daam: 0 } })).toBe(5476);
    expect(toSqFt({ system: "RAPD", values: { ropani: 0, aana: 3, paisa: 1, daam: 1 } })).toBe(
      3 * 342.25 + 85.5625 + 21.390625,
    );
  });
  it("converts Bigha-Kattha-Dhur", () => {
    expect(toSqFt({ system: "BKD", values: { bigha: 1, kattha: 2, dhur: 5 } })).toBe(72900 + 7290 + 911.25);
  });
  it("converts sq m and sq ft", () => {
    expect(toSqFt({ system: "SQM", values: { sqm: 100 } })).toBeCloseTo(1076.39, 2);
    expect(toSqFt({ system: "SQFT", values: { sqft: 1200 } })).toBe(1200);
  });
  it("rejects zero area (0-0-0-0)", () => {
    expect(isPositiveArea({ system: "RAPD", values: { ropani: 0, aana: 0, paisa: 0, daam: 0 } })).toBe(false);
    expect(isPositiveArea({ system: "RAPD", values: { ropani: 0, aana: 4, paisa: 0, daam: 0 } })).toBe(true);
  });
});

describe("decomposition", () => {
  it("round-trips RAPD", () => {
    const v = { ropani: 2, aana: 7, paisa: 3, daam: 2 };
    expect(sqFtToRapd(toSqFt({ system: "RAPD", values: v }))).toEqual(v);
  });
  it("round-trips BKD", () => {
    const v = { bigha: 1, kattha: 13, dhur: 7 };
    expect(sqFtToBkd(toSqFt({ system: "BKD", values: v }))).toEqual(v);
  });
  it("expresses areas in single units", () => {
    expect(sqFtIn(5476, "AANA")).toBe(16);
    expect(sqFtIn(3645, "DHUR")).toBe(20);
    expect(sqFtToSqm(1076.39)).toBeCloseTo(100, 1);
  });
});

describe("formatting", () => {
  it("formats original input", () => {
    const a = { system: "RAPD" as const, values: { ropani: 1, aana: 4, paisa: 0, daam: 0 } };
    expect(formatAreaInput(a, "en")).toBe("1 Ropani 4 Aana");
    expect(formatAreaInput(a, "ne")).toBe("१ रोपनी ४ आना");
    expect(rapdNotation(a.values)).toBe("1-4-0-0");
  });
  it("formats converted value", () => {
    const a = { system: "RAPD" as const, values: { ropani: 1, aana: 0, paisa: 0, daam: 0 } };
    expect(formatConverted(a, "en")).toBe("5,476 sq ft");
    expect(formatConverted({ system: "SQFT", values: { sqft: 3645 } }, "en", "TERAI")).toBe("1 Kattha");
  });
});
