/**
 * Prices are stored as integer NPR. Display follows the Nepali/Indian
 * numbering system (lakh = 1,00,000; crore = 1,00,00,000).
 */

export const LAKH = 100_000;
export const CRORE = 10_000_000;

export const PRICE_UNITS = [
  "TOTAL",
  "PER_AANA",
  "PER_ROPANI",
  "PER_KATTHA",
  "PER_DHUR",
  "PER_SQFT",
  "PER_MONTH",
] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

type Loc = "en" | "ne";

const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toDevanagariDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)]);
}

/**
 * Number with Nepali/Indian grouping, in Devanagari digits for "ne".
 * Never use Intl "ne-NP" for numbers: Chrome renders it with Latin digits
 * while Node uses Devanagari, which breaks hydration.
 */
export function formatNumber(n: number, locale: Loc = "en", maximumFractionDigits = 2): string {
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(n);
  return locale === "ne" ? toDevanagariDigits(s) : s;
}

export function toAsciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/** 21000000 → "2,10,00,000" (Nepali/Indian grouping). */
export function groupNepali(n: number): string {
  const neg = n < 0;
  const s = Math.trunc(Math.abs(n)).toString();
  if (s.length <= 3) return (neg ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (neg ? "-" : "") + rest + "," + last3;
}

const WORDS: Record<Loc, { rs: string; crore: string; lakh: string; thousand: string }> = {
  en: { rs: "Rs", crore: "Crore", lakh: "Lakh", thousand: "Thousand" },
  ne: { rs: "रु", crore: "करोड", lakh: "लाख", thousand: "हजार" },
};

/** 21000000 → "Rs 2 Crore 10 Lakh" / "रु २ करोड १० लाख". */
export function formatPriceWords(npr: number, locale: Loc = "en"): string {
  const w = WORDS[locale];
  const n = Math.round(npr);
  const crore = Math.floor(n / CRORE);
  const lakh = Math.floor((n % CRORE) / LAKH);
  const thousand = Math.floor((n % LAKH) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${crore} ${w.crore}`);
  if (lakh) parts.push(`${lakh} ${w.lakh}`);
  if (thousand) parts.push(`${thousand} ${w.thousand}`);
  if (rest || parts.length === 0) parts.push(String(rest));

  const out = `${w.rs} ${parts.join(" ")}`;
  return locale === "ne" ? toDevanagariDigits(out) : out;
}

const trimZeros = (x: number, dp: number) => Number(x.toFixed(dp)).toString();

/** 21000000 → "Rs 2.1 Cr"; 4500000 → "Rs 45 Lakh"; 25000 → "Rs 25,000". */
export function formatPriceCompact(npr: number, locale: Loc = "en"): string {
  const n = Math.round(npr);
  let out: string;
  if (locale === "ne") {
    if (n >= CRORE) out = `रु ${trimZeros(n / CRORE, 2)} करोड`;
    else if (n >= LAKH) out = `रु ${trimZeros(n / LAKH, 2)} लाख`;
    else out = `रु ${groupNepali(n)}`;
    return toDevanagariDigits(out);
  }
  if (n >= CRORE) out = `Rs ${trimZeros(n / CRORE, 2)} Cr`;
  else if (n >= LAKH) out = `Rs ${trimZeros(n / LAKH, 2)} Lakh`;
  else out = `Rs ${groupNepali(n)}`;
  return out;
}

/** Full amount with grouping: "Rs 2,10,00,000". */
export function formatPriceFull(npr: number, locale: Loc = "en"): string {
  const out = `${WORDS[locale].rs} ${groupNepali(Math.round(npr))}`;
  return locale === "ne" ? toDevanagariDigits(out) : out;
}

export const PRICE_UNIT_SUFFIX: Record<Loc, Record<PriceUnit, string>> = {
  en: {
    TOTAL: "",
    PER_AANA: "/ aana",
    PER_ROPANI: "/ ropani",
    PER_KATTHA: "/ kattha",
    PER_DHUR: "/ dhur",
    PER_SQFT: "/ sq ft",
    PER_MONTH: "/ month",
  },
  ne: {
    TOTAL: "",
    PER_AANA: "/ आना",
    PER_ROPANI: "/ रोपनी",
    PER_KATTHA: "/ कट्ठा",
    PER_DHUR: "/ धुर",
    PER_SQFT: "/ वर्ग फिट",
    PER_MONTH: "/ महिना",
  },
};

/**
 * Sanity ranges (NPR, total price) per property type and purpose. Prices
 * outside the range are not rejected; they are flagged for admin approval.
 */
export const PRICE_SANITY: Record<"SALE" | "RENT" | "LEASE", { min: number; max: number }> = {
  SALE: { min: 2 * LAKH, max: 100 * CRORE },
  RENT: { min: 2_000, max: 50 * LAKH },
  LEASE: { min: 2_000, max: 50 * LAKH },
};

export function isPriceOutlier(purpose: "SALE" | "RENT" | "LEASE", totalNpr: number): boolean {
  const r = PRICE_SANITY[purpose];
  return totalNpr < r.min || totalNpr > r.max;
}

/** Parse "2.1 crore", "45 lakh", "2,10,00,000", "रु ४५ लाख" → integer NPR. */
export function parsePrice(input: string): number | null {
  const s = toAsciiDigits(input).toLowerCase().replace(/rs\.?|रु|npr|,/g, "").trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(crore|cr|करोड|lakh|lac|l|लाख|k|thousand|हजार)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2] ?? "";
  const mult = /^(crore|cr|करोड)$/.test(unit)
    ? CRORE
    : /^(lakh|lac|l|लाख)$/.test(unit)
      ? LAKH
      : /^(k|thousand|हजार)$/.test(unit)
        ? 1000
        : 1;
  const out = Math.round(v * mult);
  return Number.isSafeInteger(out) ? out : null;
}

const UNIT_SQFT: Partial<Record<PriceUnit, number>> = {
  PER_AANA: 342.25,
  PER_ROPANI: 5476,
  PER_KATTHA: 3645,
  PER_DHUR: 182.25,
  PER_SQFT: 1,
};

/**
 * Total price used for filtering, sorting and sanity checks. Per-unit land
 * prices are multiplied out by the area; rent stays monthly. Null when the
 * price is "on request".
 */
export function computeTotalPrice(p: {
  priceNpr?: number | null;
  priceOnRequest?: boolean | null;
  priceUnit?: PriceUnit | string | null;
  areaSqFt?: number | null;
}): number | null {
  if (p.priceOnRequest || p.priceNpr == null) return null;
  const per = UNIT_SQFT[(p.priceUnit ?? "TOTAL") as PriceUnit];
  if (!per) return Math.round(p.priceNpr);
  if (!p.areaSqFt) return null;
  return Math.round((p.priceNpr * p.areaSqFt) / per);
}
