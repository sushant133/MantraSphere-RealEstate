import type { PropertyStatus, PropertyType, Purpose, Tier } from "@/lib/constants";
import type { PriceUnit } from "@/lib/price";
import type { AreaInput } from "@/lib/units";

/**
 * Plain, serialisable shapes passed to (client) components. ObjectIds and
 * Dates are converted to strings here, never in components.
 * Contact phone numbers are deliberately NOT part of any DTO: they are
 * revealed through a logged server action ("Show number").
 */

export type I18n = { en: string; ne: string };
export type LocNames = { province?: I18n & { slug: string }; district: I18n & { slug: string }; municipality?: I18n & { slug: string } };

export type ImageDTO = { url: string; width: number; height: number; blurDataURL: string; alt: string };

export type PropertyCardDTO = {
  id: string;
  code: string;
  slug: string;
  title: I18n;
  purpose: Purpose;
  type: PropertyType;
  status: PropertyStatus;
  priceNpr: number | null;
  priceOnRequest: boolean;
  priceUnit: PriceUnit;
  negotiable: boolean;
  areaSqFt: number | null;
  areaInput: AreaInput | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  facing: string | null;
  roadWidthFt: number | null;
  locationNames: LocNames;
  address: string;
  tier: Tier;
  cover: ImageDTO | null;
  createdAt: string;
  soldAt: string | null;
};

export type PropertyDetailDTO = PropertyCardDTO & {
  description: I18n;
  images: ImageDTO[];
  videos: { kind: "YOUTUBE" | "TOUR_360"; url: string }[];
  amenities: { slug: string; name: I18n; icon: string }[];
  nearby: { kind: string; name: string; distanceM: number | null }[];
  builtUpAreaSqFt: number | null;
  roadType: string | null;
  mainRoadDistanceM: number | null;
  floors: number | null;
  kitchens: number | null;
  livingRooms: number | null;
  furnishing: string | null;
  builtYear: number | null;
  readyToMove: boolean | null;
  ownershipType: string | null;
  coordinates: [number, number] | null; // [lng, lat]
  ward: number | null;
  contactName: string;
  postedBy: "OWNER" | "AGENT" | "COMPANY";
  ownerVerified: boolean;
  hasWhatsapp: boolean;
  hasViber: boolean;
  views: number;
  updatedAt: string;
  publishedAt: string | null;
  districtId: string;
  priceTotalNpr: number | null;
};

export type MapPointDTO = {
  code: string;
  slug: string;
  lng: number;
  lat: number;
  title: I18n;
  priceNpr: number | null;
  priceOnRequest: boolean;
  priceUnit: PriceUnit;
  purpose: Purpose;
};

/** MongoDB projection for cards (only what a card renders). */
export const CARD_PROJECTION = {
  code: 1, slug: 1, title: 1, purpose: 1, type: 1, status: 1, priceNpr: 1, priceOnRequest: 1, priceUnit: 1,
  negotiable: 1, areaSqFt: 1, areaInput: 1, bedrooms: 1, bathrooms: 1, parking: 1, facing: 1, roadWidthFt: 1,
  locationNames: 1, address: 1, tier: 1, images: { $slice: 1 }, createdAt: 1, soldAt: 1,
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: any) => (v == null ? null : String(v));
const iso = (v: any) => (v ? new Date(v).toISOString() : null);
const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function image(i: any): ImageDTO {
  return { url: i.url, width: i.width, height: i.height, blurDataURL: i.blurDataURL ?? "", alt: i.alt ?? "" };
}

export function toCardDTO(d: any): PropertyCardDTO {
  const imgs: any[] = d.images ?? [];
  const cover = imgs.find((i) => i.isCover) ?? imgs[0];
  return {
    id: String(d._id),
    code: d.code,
    slug: d.slug,
    title: { en: d.title?.en ?? "", ne: d.title?.ne || d.title?.en || "" },
    purpose: d.purpose,
    type: d.type,
    status: d.status,
    priceNpr: num(d.priceNpr),
    priceOnRequest: !!d.priceOnRequest,
    priceUnit: d.priceUnit ?? "TOTAL",
    negotiable: !!d.negotiable,
    areaSqFt: num(d.areaSqFt),
    areaInput: d.areaInput?.system ? { system: d.areaInput.system, values: d.areaInput.values } : null,
    bedrooms: num(d.bedrooms),
    bathrooms: num(d.bathrooms),
    parking: num(d.parking),
    facing: str(d.facing),
    roadWidthFt: num(d.roadWidthFt),
    locationNames: stripIds(d.locationNames),
    address: d.address ?? "",
    tier: d.tier ?? "NORMAL",
    cover: cover ? image(cover) : null,
    createdAt: iso(d.createdAt) ?? new Date(0).toISOString(),
    soldAt: iso(d.soldAt),
  };
}

export function toDetailDTO(d: any, extra: { amenities: PropertyDetailDTO["amenities"]; ownerVerified: boolean }): PropertyDetailDTO {
  const images = [...(d.images ?? [])].sort((a: any, b: any) => Number(b.isCover) - Number(a.isCover) || a.order - b.order);
  return {
    ...toCardDTO({ ...d, images }),
    description: { en: d.description?.en ?? "", ne: d.description?.ne ?? "" },
    images: images.map(image),
    videos: (d.videos ?? []).map((v: any) => ({ kind: v.kind, url: v.url })),
    amenities: extra.amenities,
    nearby: (d.nearby ?? []).map((n: any) => ({ kind: n.kind, name: n.name, distanceM: num(n.distanceM) })),
    builtUpAreaSqFt: num(d.builtUpAreaSqFt),
    roadType: str(d.roadType),
    mainRoadDistanceM: num(d.mainRoadDistanceM),
    floors: num(d.floors),
    kitchens: num(d.kitchens),
    livingRooms: num(d.livingRooms),
    furnishing: str(d.furnishing),
    builtYear: num(d.builtYear),
    readyToMove: typeof d.readyToMove === "boolean" ? d.readyToMove : null,
    ownershipType: str(d.ownershipType),
    coordinates: d.location?.coordinates?.length === 2 ? [d.location.coordinates[0], d.location.coordinates[1]] : null,
    ward: num(d.ward),
    contactName: d.contactName ?? "",
    postedBy: d.postedBy ?? "OWNER",
    ownerVerified: extra.ownerVerified,
    hasWhatsapp: !!d.whatsapp,
    hasViber: !!d.viber,
    views: num(d.views) ?? 0,
    updatedAt: iso(d.updatedAt) ?? new Date(0).toISOString(),
    publishedAt: iso(d.publishedAt),
    districtId: String(d.district),
    priceTotalNpr: num(d.priceTotalNpr),
  };
}

function stripIds(ln: any): LocNames {
  const pick = (x: any) => (x ? { en: x.en ?? "", ne: x.ne ?? x.en ?? "", slug: x.slug ?? "" } : undefined);
  return { province: pick(ln?.province), district: pick(ln?.district)!, municipality: pick(ln?.municipality) };
}
