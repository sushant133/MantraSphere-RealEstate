import type { Locale } from "@/lib/constants";
import { formatPriceCompact, formatPriceWords, PRICE_UNIT_SUFFIX, toDevanagariDigits, type PriceUnit } from "@/lib/price";
import { formatAreaInput, formatConverted, SQFT, type AreaInput } from "@/lib/units";

/** Client-safe display helpers for property DTOs. */

export const fmtNumber = (n: number, locale: Locale) => {
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  return locale === "ne" ? toDevanagariDigits(s) : s;
};

export const localDigits = (s: string, locale: Locale) => (locale === "ne" ? toDevanagariDigits(s) : s);

/** { main: "Rs 2.1 Cr", suffix: "/ month" } or null when price is on request. */
export function displayPrice(
  p: { priceNpr: number | null; priceOnRequest: boolean; priceUnit: PriceUnit },
  locale: Locale,
): { main: string; words: string; suffix: string } | null {
  if (p.priceOnRequest || p.priceNpr == null) return null;
  return {
    main: formatPriceCompact(p.priceNpr, locale),
    words: formatPriceWords(p.priceNpr, locale),
    suffix: PRICE_UNIT_SUFFIX[locale][p.priceUnit] ?? "",
  };
}

export function displayArea(p: { areaInput: AreaInput | null; areaSqFt: number | null }, locale: Locale): string | null {
  if (p.areaInput) return formatAreaInput(p.areaInput, locale);
  if (p.areaSqFt) return formatAreaInput({ system: "SQFT", values: { sqft: p.areaSqFt } }, locale);
  return null;
}

export function displayAreaConverted(
  p: { areaInput: AreaInput | null },
  locale: Locale,
  region: "HILL" | "TERAI" = "HILL",
): string | null {
  return p.areaInput ? formatConverted(p.areaInput, locale, region) : null;
}

/**
 * For a total sale price of land/houses, the implied rate per local unit
 * ("≈ Rs 33.5 Lakh per aana"), using the unit system the owner entered.
 */
export function impliedUnitRate(
  p: { priceNpr: number | null; priceOnRequest: boolean; priceUnit: PriceUnit; areaSqFt: number | null; areaInput: AreaInput | null; purpose: string },
  locale: Locale,
): { price: string; unit: string } | null {
  if (p.priceOnRequest || !p.priceNpr || p.priceUnit !== "TOTAL" || p.purpose !== "SALE" || !p.areaSqFt) return null;
  const sys = p.areaInput?.system;
  if (sys !== "RAPD" && sys !== "BKD") return null;
  const [unitSqft, unit] = sys === "BKD" ? [SQFT.KATTHA, locale === "ne" ? "कट्ठा" : "kattha"] : [SQFT.AANA, locale === "ne" ? "आना" : "aana"];
  return { price: formatPriceCompact(Math.round((p.priceNpr * unitSqft) / p.areaSqFt), locale), unit };
}

export function placeLine(ln: { municipality?: { en: string; ne: string }; district: { en: string; ne: string } }, address: string, locale: Locale) {
  const parts = [address, ln.municipality?.[locale], ln.district?.[locale]].filter(Boolean) as string[];
  return [...new Set(parts)].join(", ");
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" }).format(
    new Date(iso),
  );
}
