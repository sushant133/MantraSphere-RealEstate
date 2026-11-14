import type { Locale, PropertyType, Purpose } from "./constants";

/**
 * Listing titles are generated from structured data (fix #23), e.g.
 * "4BHK House for Sale in Ramkot, Kathmandu". Staff may override them.
 */

const TYPE_LABEL: Record<Locale, Record<PropertyType, string>> = {
  en: {
    HOUSE: "House",
    LAND: "Land",
    FLAT: "Flat",
    BUNGALOW: "Bungalow",
    COMMERCIAL: "Commercial Space",
    OFFICE: "Office Space",
    SHOP: "Shop",
  },
  ne: {
    HOUSE: "घर",
    LAND: "जग्गा",
    FLAT: "फ्ल्याट",
    BUNGALOW: "बंगला",
    COMMERCIAL: "व्यावसायिक स्थान",
    OFFICE: "अफिस स्थान",
    SHOP: "पसल",
  },
};

const PURPOSE_LABEL: Record<Locale, Record<Purpose, string>> = {
  en: { SALE: "for Sale", RENT: "for Rent", LEASE: "for Lease" },
  ne: { SALE: "बिक्रीमा", RENT: "भाडामा", LEASE: "लिजमा" },
};

export type TitleInput = {
  purpose: Purpose;
  type: PropertyType;
  bedrooms?: number | null;
  area?: string | null; // e.g. "8 Aana" for land
  place?: { en: string; ne: string } | null; // municipality / area
  district: { en: string; ne: string };
};

export function generateTitle(input: TitleInput, locale: Locale): string {
  const type = TYPE_LABEL[locale][input.type];
  const purpose = PURPOSE_LABEL[locale][input.purpose];
  const bhk =
    input.bedrooms && ["HOUSE", "FLAT", "BUNGALOW"].includes(input.type) ? `${input.bedrooms}BHK ` : "";
  const area = input.type === "LAND" && input.area ? `${input.area} ` : "";
  const placeName = input.place?.[locale];
  const where =
    placeName && placeName !== input.district[locale]
      ? `${placeName}, ${input.district[locale]}`
      : input.district[locale];

  if (locale === "ne") {
    return `${where}मा ${bhk}${area}${type} ${purpose}`.replace(/\s+/g, " ").trim();
  }
  return `${bhk}${area}${type} ${purpose} in ${where}`.replace(/\s+/g, " ").trim();
}

export function typeLabel(type: PropertyType, locale: Locale) {
  return TYPE_LABEL[locale][type];
}
export function purposeLabel(purpose: Purpose, locale: Locale) {
  return PURPOSE_LABEL[locale][purpose];
}
