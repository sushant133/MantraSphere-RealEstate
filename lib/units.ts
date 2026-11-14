import { formatNumber } from "./price";

/**
 * Nepali land-area units. Canonical storage is square feet (`areaSqFt`);
 * the owner's original input is kept in `areaInput` for display.
 */

export const SQFT = {
  ROPANI: 5476,
  AANA: 342.25,
  PAISA: 85.5625,
  DAAM: 21.390625,
  BIGHA: 72900,
  KATTHA: 3645,
  DHUR: 182.25,
  SQM: 10.7639,
  SQFT: 1,
} as const;

export const AREA_SYSTEMS = ["RAPD", "BKD", "SQFT", "SQM"] as const;
export type AreaSystem = (typeof AREA_SYSTEMS)[number];

export type RapdValues = { ropani: number; aana: number; paisa: number; daam: number };
export type BkdValues = { bigha: number; kattha: number; dhur: number };
export type AreaInput =
  | { system: "RAPD"; values: RapdValues }
  | { system: "BKD"; values: BkdValues }
  | { system: "SQFT"; values: { sqft: number } }
  | { system: "SQM"; values: { sqm: number } };

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Convert a structured area input to canonical square feet. */
export function toSqFt(input: AreaInput): number {
  switch (input.system) {
    case "RAPD": {
      const { ropani, aana, paisa, daam } = input.values;
      return ropani * SQFT.ROPANI + aana * SQFT.AANA + paisa * SQFT.PAISA + daam * SQFT.DAAM;
    }
    case "BKD": {
      const { bigha, kattha, dhur } = input.values;
      return bigha * SQFT.BIGHA + kattha * SQFT.KATTHA + dhur * SQFT.DHUR;
    }
    case "SQFT":
      return input.values.sqft;
    case "SQM":
      return input.values.sqm * SQFT.SQM;
  }
}

/** Decompose square feet into Ropani-Aana-Paisa-Daam (daam may be fractional). */
export function sqFtToRapd(sqft: number): RapdValues {
  let rest = sqft;
  const ropani = Math.floor(rest / SQFT.ROPANI + 1e-9);
  rest -= ropani * SQFT.ROPANI;
  const aana = Math.floor(rest / SQFT.AANA + 1e-9);
  rest -= aana * SQFT.AANA;
  const paisa = Math.floor(rest / SQFT.PAISA + 1e-9);
  rest -= paisa * SQFT.PAISA;
  const daam = round(Math.max(0, rest / SQFT.DAAM));
  return { ropani, aana, paisa, daam };
}

/** Decompose square feet into Bigha-Kattha-Dhur (dhur may be fractional). */
export function sqFtToBkd(sqft: number): BkdValues {
  let rest = sqft;
  const bigha = Math.floor(rest / SQFT.BIGHA + 1e-9);
  rest -= bigha * SQFT.BIGHA;
  const kattha = Math.floor(rest / SQFT.KATTHA + 1e-9);
  rest -= kattha * SQFT.KATTHA;
  const dhur = round(Math.max(0, rest / SQFT.DHUR));
  return { bigha, kattha, dhur };
}

export function sqFtToSqm(sqft: number): number {
  return round(sqft / SQFT.SQM);
}

/** Express an area in a single unit, e.g. 2738 sq ft → 8 (aana). */
export function sqFtIn(sqft: number, unit: keyof typeof SQFT): number {
  return round(sqft / SQFT[unit], 4);
}

export function isPositiveArea(input: AreaInput): boolean {
  const v = toSqFt(input);
  return Number.isFinite(v) && v > 0;
}

type Loc = "en" | "ne";
const LABELS: Record<Loc, Record<string, string>> = {
  en: {
    ropani: "Ropani", aana: "Aana", paisa: "Paisa", daam: "Daam",
    bigha: "Bigha", kattha: "Kattha", dhur: "Dhur", sqft: "sq ft", sqm: "sq m",
  },
  ne: {
    ropani: "रोपनी", aana: "आना", paisa: "पैसा", daam: "दाम",
    bigha: "बिघा", kattha: "कट्ठा", dhur: "धुर", sqft: "वर्ग फिट", sqm: "वर्ग मिटर",
  },
};

const fmtNum = (n: number, locale: Loc) =>
  formatNumber(n, locale, 2);

function joinParts(parts: [string, number][], locale: Loc): string {
  const nonZero = parts.filter(([, v]) => v > 0);
  if (nonZero.length === 0) return `0 ${LABELS[locale][parts[parts.length - 1][0]]}`;
  return nonZero.map(([k, v]) => `${fmtNum(v, locale)} ${LABELS[locale][k]}`).join(" ");
}

/** Human-readable area in the owner's original system, e.g. "1 Ropani 4 Aana". */
export function formatAreaInput(input: AreaInput, locale: Loc = "en"): string {
  switch (input.system) {
    case "RAPD": {
      const v = input.values;
      return joinParts([["ropani", v.ropani], ["aana", v.aana], ["paisa", v.paisa], ["daam", v.daam]], locale);
    }
    case "BKD": {
      const v = input.values;
      return joinParts([["bigha", v.bigha], ["kattha", v.kattha], ["dhur", v.dhur]], locale);
    }
    case "SQFT":
      return `${fmtNum(round(input.values.sqft), locale)} ${LABELS[locale].sqft}`;
    case "SQM":
      return `${fmtNum(round(input.values.sqm), locale)} ${LABELS[locale].sqm}`;
  }
}

/** Short R-A-P-D notation used on Nepali listings, e.g. "1-4-0-0". */
export function rapdNotation(v: RapdValues): string {
  return `${v.ropani}-${v.aana}-${v.paisa}-${v.daam}`;
}

/**
 * Converted companion value shown next to the original:
 * traditional systems → sq ft; sq ft / sq m → aana (hill) or kattha (terai).
 */
export function formatConverted(input: AreaInput, locale: Loc = "en", region: "HILL" | "TERAI" = "HILL"): string {
  const sqft = toSqFt(input);
  if (input.system === "RAPD" || input.system === "BKD") {
    return `${fmtNum(Math.round(sqft), locale)} ${LABELS[locale].sqft}`;
  }
  return region === "TERAI"
    ? `${fmtNum(sqFtIn(sqft, "KATTHA"), locale)} ${LABELS[locale].kattha}`
    : `${fmtNum(sqFtIn(sqft, "AANA"), locale)} ${LABELS[locale].aana}`;
}
