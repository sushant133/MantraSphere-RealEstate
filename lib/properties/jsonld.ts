import type { Locale } from "@/lib/constants";
import { SITE_URL, absoluteUrl } from "@/lib/seo";
import type { PropertyDetailDTO } from "./dto";

const PLACE_TYPE: Record<string, string> = {
  HOUSE: "SingleFamilyResidence",
  BUNGALOW: "SingleFamilyResidence",
  FLAT: "Apartment",
  LAND: "Place",
  COMMERCIAL: "Place",
  OFFICE: "Place",
  SHOP: "Place",
};

/** RealEstateListing + Offer + Place (fix #4). */
export function listingJsonLd(p: PropertyDetailDTO, locale: Locale) {
  const url = absoluteUrl(locale, `/property/${p.slug}`);
  const availability = p.status === "ACTIVE" ? "https://schema.org/InStock" : "https://schema.org/SoldOut";
  const place: Record<string, unknown> = {
    "@type": PLACE_TYPE[p.type] ?? "Place",
    name: p.title[locale],
    address: {
      "@type": "PostalAddress",
      streetAddress: p.address || undefined,
      addressLocality: p.locationNames.municipality?.en,
      addressRegion: p.locationNames.district.en,
      addressCountry: "NP",
    },
    ...(p.coordinates ? { geo: { "@type": "GeoCoordinates", latitude: p.coordinates[1], longitude: p.coordinates[0] } } : {}),
    ...(p.areaSqFt ? { floorSize: { "@type": "QuantitativeValue", value: Math.round(p.areaSqFt), unitCode: "FTK" } } : {}),
    ...(p.bedrooms ? { numberOfRooms: p.bedrooms, numberOfBedrooms: p.bedrooms } : {}),
    ...(p.bathrooms ? { numberOfBathroomsTotal: p.bathrooms } : {}),
  };
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${url}#listing`,
    url,
    name: p.title[locale],
    description: p.description[locale] || p.description.en,
    identifier: p.code,
    inLanguage: locale === "ne" ? "ne-NP" : "en-NP",
    datePosted: p.publishedAt ?? p.createdAt,
    dateModified: p.updatedAt,
    image: p.images.map((i) => `${SITE_URL}${i.url}`),
    about: place,
    offers: {
      "@type": "Offer",
      url,
      businessFunction: p.purpose === "SALE" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut",
      availability,
      priceCurrency: "NPR",
      ...(p.priceOnRequest || p.priceNpr == null
        ? {}
        : p.priceUnit === "PER_MONTH"
          ? { priceSpecification: { "@type": "UnitPriceSpecification", price: p.priceNpr, priceCurrency: "NPR", unitCode: "MON" } }
          : { price: p.priceTotalNpr ?? p.priceNpr }),
      seller: { "@id": `${SITE_URL}/#organization` },
    },
  };
}
