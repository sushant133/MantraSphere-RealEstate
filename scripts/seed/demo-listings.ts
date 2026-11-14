import type { Types } from "mongoose";
import type { ProcessedImage } from "@/lib/images";
import { suggestAlt } from "@/lib/images";
import { TIER_RANK, type PropertyType, type Purpose, type Tier } from "@/lib/constants";
import { toSqFt, formatAreaInput, formatConverted, type AreaInput } from "@/lib/units";
import { toDevanagariDigits } from "@/lib/price";
import { generateTitle, typeLabel } from "@/lib/titles";
import { propertySlug } from "@/lib/slug";
import { buildSearchKeywords } from "@/lib/search-keywords";
import { SCENE_FOR_TYPE } from "./demo-images";

/**
 * 30 deterministic demo listings for development and screenshots. All are
 * flagged `isDemo: true` and owned by the company account.
 */

type Place = {
  district: string;
  muni: string;
  area: string;
  areaNe: string;
  lat: number;
  lng: number;
  terai: boolean;
  /** NPR per aana (hill) or per kattha (terai) for land in this locality. */
  landRate: number;
  /** Monthly rent for a typical 2BHK flat. */
  rent2bhk: number;
};

const L = 100_000;
export const PLACES: Place[] = [
  { district: "Kathmandu", muni: "Kathmandu", area: "Baluwatar", areaNe: "बालुवाटार", lat: 27.7286, lng: 85.33, terai: false, landRate: 110 * L, rent2bhk: 55000 },
  { district: "Kathmandu", muni: "Tokha", area: "Grande", areaNe: "ग्रान्डे", lat: 27.752, lng: 85.327, terai: false, landRate: 28 * L, rent2bhk: 28000 },
  { district: "Kathmandu", muni: "Kirtipur", area: "Naya Bazar", areaNe: "नयाँ बजार", lat: 27.6787, lng: 85.2775, terai: false, landRate: 32 * L, rent2bhk: 25000 },
  { district: "Kathmandu", muni: "Chandragiri", area: "Naikap", areaNe: "नैकाप", lat: 27.695, lng: 85.263, terai: false, landRate: 24 * L, rent2bhk: 22000 },
  { district: "Lalitpur", muni: "Lalitpur", area: "Sanepa", areaNe: "सानेपा", lat: 27.6847, lng: 85.3065, terai: false, landRate: 75 * L, rent2bhk: 50000 },
  { district: "Lalitpur", muni: "Mahalaxmi", area: "Imadol", areaNe: "इमाडोल", lat: 27.664, lng: 85.342, terai: false, landRate: 30 * L, rent2bhk: 26000 },
  { district: "Lalitpur", muni: "Godawari", area: "Taukhel", areaNe: "टौखेल", lat: 27.623, lng: 85.327, terai: false, landRate: 18 * L, rent2bhk: 20000 },
  { district: "Bhaktapur", muni: "Suryabinayak", area: "Sallaghari", areaNe: "सल्लाघारी", lat: 27.67, lng: 85.44, terai: false, landRate: 35 * L, rent2bhk: 24000 },
  { district: "Bhaktapur", muni: "Bhaktapur", area: "Kamalbinayak", areaNe: "कमलबिनायक", lat: 27.675, lng: 85.435, terai: false, landRate: 30 * L, rent2bhk: 22000 },
  { district: "Kaski", muni: "Pokhara", area: "Lakeside", areaNe: "लेकसाइड", lat: 28.21, lng: 83.958, terai: false, landRate: 60 * L, rent2bhk: 35000 },
  { district: "Kaski", muni: "Pokhara", area: "Chipledhunga", areaNe: "चिप्लेढुंगा", lat: 28.218, lng: 83.989, terai: false, landRate: 80 * L, rent2bhk: 30000 },
  { district: "Chitwan", muni: "Bharatpur", area: "Chaubiskoti", areaNe: "चौबीसकोठी", lat: 27.684, lng: 84.43, terai: true, landRate: 55 * L, rent2bhk: 22000 },
  { district: "Rupandehi", muni: "Butwal", area: "Golpark", areaNe: "गोलपार्क", lat: 27.695, lng: 83.458, terai: true, landRate: 45 * L, rent2bhk: 20000 },
  { district: "Rupandehi", muni: "Siddharthanagar", area: "Milanchowk", areaNe: "मिलनचोक", lat: 27.505, lng: 83.452, terai: true, landRate: 38 * L, rent2bhk: 18000 },
  { district: "Morang", muni: "Biratnagar", area: "Traffic Chowk", areaNe: "ट्राफिक चोक", lat: 26.456, lng: 87.28, terai: true, landRate: 70 * L, rent2bhk: 20000 },
  { district: "Sunsari", muni: "Itahari", area: "Itahari Chowk", areaNe: "इटहरी चोक", lat: 26.664, lng: 87.274, terai: true, landRate: 35 * L, rent2bhk: 16000 },
  { district: "Siraha", muni: "Lahan", area: "Lahan Bazar", areaNe: "लहान बजार", lat: 26.72, lng: 86.484, terai: true, landRate: 18 * L, rent2bhk: 12000 },
  { district: "Siraha", muni: "Dhangadhimai", area: "Ward 10", areaNe: "वडा १०", lat: 26.734, lng: 86.342, terai: true, landRate: 8 * L, rent2bhk: 9000 },
  { district: "Siraha", muni: "Siraha", area: "Siraha Bazar", areaNe: "सिरहा बजार", lat: 26.655, lng: 86.207, terai: true, landRate: 14 * L, rent2bhk: 10000 },
  { district: "Dhanusha", muni: "Janakpurdham", area: "Ramanand Chowk", areaNe: "रामानन्द चोक", lat: 26.727, lng: 85.93, terai: true, landRate: 30 * L, rent2bhk: 15000 },
  { district: "Kailali", muni: "Dhangadhi", area: "Campus Road", areaNe: "क्याम्पस रोड", lat: 28.698, lng: 80.59, terai: true, landRate: 25 * L, rent2bhk: 14000 },
];

type Spec = {
  p: number; // place index
  type: PropertyType;
  purpose: Purpose;
  tier: Tier;
  status?: "ACTIVE" | "SOLD" | "RENTED";
  beds?: number;
  /** Land: aana (hill) or kattha (terai). Built: plot for houses; floor sq ft for flats/commercial. */
  size: number;
  floors?: number;
  unit?: "PER_AANA" | "PER_KATTHA";
  onRequest?: boolean;
};

// 30 listings: 4 HIGHLIGHT, 5 TOP, 5 PREMIUM, 6 LATEST, 10 NORMAL; 3 SOLD + 1 RENTED.
export const SPECS: Spec[] = [
  { p: 0, type: "BUNGALOW", purpose: "SALE", tier: "HIGHLIGHT", beds: 6, size: 12, floors: 3, onRequest: true },
  { p: 4, type: "HOUSE", purpose: "SALE", tier: "HIGHLIGHT", beds: 5, size: 6, floors: 3 },
  { p: 9, type: "COMMERCIAL", purpose: "SALE", tier: "HIGHLIGHT", size: 4200, floors: 4 },
  { p: 11, type: "HOUSE", purpose: "SALE", tier: "HIGHLIGHT", beds: 4, size: 4, floors: 2 },
  { p: 1, type: "HOUSE", purpose: "SALE", tier: "TOP", beds: 4, size: 4, floors: 2.5 },
  { p: 7, type: "LAND", purpose: "SALE", tier: "TOP", size: 8 },
  { p: 14, type: "LAND", purpose: "SALE", tier: "TOP", size: 10, unit: "PER_KATTHA" },
  { p: 5, type: "FLAT", purpose: "SALE", tier: "TOP", beds: 3, size: 1450 },
  { p: 10, type: "OFFICE", purpose: "RENT", tier: "TOP", size: 2200 },
  { p: 2, type: "HOUSE", purpose: "RENT", tier: "PREMIUM", beds: 3, size: 4, floors: 2 },
  { p: 12, type: "HOUSE", purpose: "SALE", tier: "PREMIUM", beds: 5, size: 5, floors: 2.5 },
  { p: 3, type: "LAND", purpose: "SALE", tier: "PREMIUM", size: 16, unit: "PER_AANA" },
  { p: 19, type: "SHOP", purpose: "RENT", tier: "PREMIUM", size: 320 },
  { p: 6, type: "FLAT", purpose: "RENT", tier: "PREMIUM", beds: 2, size: 1050 },
  { p: 15, type: "HOUSE", purpose: "SALE", tier: "LATEST", beds: 4, size: 3, floors: 2 },
  { p: 16, type: "LAND", purpose: "SALE", tier: "LATEST", size: 6 },
  { p: 17, type: "LAND", purpose: "SALE", tier: "LATEST", size: 20 },
  { p: 8, type: "HOUSE", purpose: "SALE", tier: "LATEST", beds: 3, size: 3, floors: 2.5 },
  { p: 13, type: "COMMERCIAL", purpose: "LEASE", tier: "LATEST", size: 6000, floors: 2 },
  { p: 20, type: "HOUSE", purpose: "RENT", tier: "LATEST", beds: 3, size: 4, floors: 2 },
  { p: 18, type: "HOUSE", purpose: "SALE", tier: "NORMAL", beds: 4, size: 4, floors: 2 },
  { p: 1, type: "FLAT", purpose: "RENT", tier: "NORMAL", beds: 2, size: 950 },
  { p: 11, type: "LAND", purpose: "SALE", tier: "NORMAL", size: 5 },
  { p: 9, type: "FLAT", purpose: "RENT", tier: "NORMAL", beds: 1, size: 650 },
  { p: 2, type: "LAND", purpose: "SALE", tier: "NORMAL", size: 4 },
  { p: 14, type: "SHOP", purpose: "RENT", tier: "NORMAL", size: 400 },
  { p: 16, type: "HOUSE", purpose: "SALE", tier: "NORMAL", beds: 4, size: 3, floors: 2, status: "SOLD" },
  { p: 5, type: "LAND", purpose: "SALE", tier: "NORMAL", size: 6, status: "SOLD" },
  { p: 12, type: "LAND", purpose: "SALE", tier: "NORMAL", size: 8, status: "SOLD" },
  { p: 4, type: "FLAT", purpose: "RENT", tier: "NORMAL", beds: 2, size: 1100, status: "RENTED" },
];

// ---- helpers -------------------------------------------------------------

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

const FACING = ["EAST", "SOUTH", "NORTH_EAST", "SOUTH_EAST", "WEST", "NORTH"] as const;
const FACING_LABEL: Record<string, { en: string; ne: string }> = {
  EAST: { en: "east", ne: "पूर्व" }, WEST: { en: "west", ne: "पश्चिम" }, NORTH: { en: "north", ne: "उत्तर" },
  SOUTH: { en: "south", ne: "दक्षिण" }, NORTH_EAST: { en: "north-east", ne: "उत्तर-पूर्व" },
  SOUTH_EAST: { en: "south-east", ne: "दक्षिण-पूर्व" },
};
const ROAD_LABEL: Record<string, { en: string; ne: string }> = {
  BLACKTOPPED: { en: "blacktopped", ne: "कालोपत्रे" }, PAVED: { en: "paved", ne: "ढलान" },
  GRAVELLED: { en: "gravelled", ne: "ग्राभेल" },
};
const FURN_LABEL: Record<string, { en: string; ne: string }> = {
  UNFURNISHED: { en: "unfurnished", ne: "फर्निचरबिना" },
  SEMI_FURNISHED: { en: "semi-furnished", ne: "आंशिक फर्निचरसहित" },
  FULLY_FURNISHED: { en: "fully furnished", ne: "पूर्ण फर्निचरसहित" },
};

export type LocationRefs = {
  province: { _id: Types.ObjectId; name: { en: string; ne: string }; slug: string };
  district: { _id: Types.ObjectId; name: { en: string; ne: string }; slug: string };
  municipality: { _id: Types.ObjectId; name: { en: string; ne: string }; slug: string };
};

export function buildDemoListing(opts: {
  index: number;
  spec: Spec;
  code: string;
  loc: LocationRefs;
  ownerId: Types.ObjectId;
  phones: string[];
  images: (ProcessedImage & { room?: string })[];
  now: Date;
  planDurationDays: number | null;
}) {
  const { spec, loc, index, code, now } = opts;
  const place = PLACES[spec.p];
  const r = rng(index + 7);
  const isBuilt = !["LAND"].includes(spec.type);
  const isResidential = ["HOUSE", "BUNGALOW", "FLAT"].includes(spec.type);
  const hasPlot = ["HOUSE", "BUNGALOW", "LAND"].includes(spec.type);

  // ---- area ----
  let areaInput: AreaInput;
  if (hasPlot) {
    areaInput = place.terai
      ? { system: "BKD", values: { bigha: Math.floor(spec.size / 20), kattha: spec.size % 20, dhur: 0 } }
      : { system: "RAPD", values: { ropani: Math.floor(spec.size / 16), aana: spec.size % 16, paisa: 0, daam: 0 } };
  } else {
    areaInput = { system: "SQFT", values: { sqft: spec.size } };
  }
  const areaSqFt = Math.round(toSqFt(areaInput) * 100) / 100;
  const floors = spec.floors;
  const builtUpAreaSqFt =
    spec.type === "HOUSE" || spec.type === "BUNGALOW"
      ? roundTo(Math.min(areaSqFt * 0.5, 1400) * (floors ?? 2), 50) // footprint capped at 1,400 sq ft
      : isBuilt
        ? spec.size
        : undefined;

  // ---- price (integer NPR) ----
  const ratePerSqFt = place.landRate / (place.terai ? 3645 : 342.25);
  let priceNpr: number | null = null;
  let priceUnit: string = spec.purpose === "SALE" ? "TOTAL" : "PER_MONTH";
  if (!spec.onRequest) {
    if (spec.purpose === "SALE") {
      if (spec.type === "LAND") {
        if (spec.unit) {
          priceUnit = spec.unit;
          priceNpr = roundTo(place.landRate * (0.9 + r() * 0.2), 10_000);
        } else {
          priceNpr = roundTo(areaSqFt * ratePerSqFt * (0.9 + r() * 0.2), 50_000);
        }
      } else if (spec.type === "FLAT") {
        priceNpr = roundTo(spec.size * (9_000 + ratePerSqFt * 0.08), 100_000);
      } else if (spec.type === "COMMERCIAL") {
        priceNpr = roundTo(spec.size * (ratePerSqFt * 0.6 + 8_000), 500_000);
      } else {
        priceNpr = roundTo(areaSqFt * ratePerSqFt + (builtUpAreaSqFt ?? 0) * 4_500, 100_000);
      }
    } else {
      const base = place.rent2bhk;
      const m =
        spec.type === "FLAT" ? (spec.beds ?? 2) / 2
          : spec.type === "HOUSE" ? 1.8
            : spec.type === "OFFICE" ? spec.size / 900
              : spec.type === "SHOP" ? spec.size / 450
                : spec.size / 600; // commercial lease
      priceNpr = roundTo(base * m, 1_000);
    }
  }

  // ---- details (only fields that apply to the type) ----
  const facing = FACING[index % FACING.length];
  const roadType = (["BLACKTOPPED", "PAVED", "GRAVELLED"] as const)[index % 3];
  const roadWidthFt = [13, 16, 20, 24, 12][index % 5];
  const mainRoadDistanceM = [0, 50, 150, 300, 600][index % 5];
  const furnishing = (["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"] as const)[index % 3];
  const beds = spec.beds;
  const bathrooms = beds ? Math.max(1, beds - 1) : spec.type === "LAND" ? undefined : spec.size > 1500 ? 4 : 1;
  const parking = spec.type === "LAND" ? undefined : spec.type === "SHOP" ? 0 : spec.type === "FLAT" ? 1 : 2;

  const ln = {
    province: { en: loc.province.name.en, ne: loc.province.name.ne, slug: loc.province.slug },
    district: { en: loc.district.name.en, ne: loc.district.name.ne, slug: loc.district.slug },
    municipality: { en: loc.municipality.name.en, ne: loc.municipality.name.ne, slug: loc.municipality.slug },
  };
  const areaLabelEn = spec.type === "LAND" ? formatAreaInput(areaInput, "en") : null;
  const titleEn = generateTitle(
    { purpose: spec.purpose, type: spec.type, bedrooms: beds, area: areaLabelEn, place: ln.municipality, district: ln.district },
    "en",
  );
  const titleNe = generateTitle(
    {
      purpose: spec.purpose, type: spec.type, bedrooms: beds,
      area: spec.type === "LAND" ? formatAreaInput(areaInput, "ne") : null,
      place: ln.municipality, district: ln.district,
    },
    "ne",
  );

  // ---- descriptions generated from the structured fields (no contradictions) ----
  const n = (x: number | string) => toDevanagariDigits(String(x));
  const where = [...new Set([place.area, ln.municipality.en, ln.district.en])].join(", ");
  const whereNe = [...new Set([place.areaNe, ln.municipality.ne, ln.district.ne])].join(", ");
  const hasRoadInfo = spec.type !== "FLAT" && spec.type !== "OFFICE";
  const en: string[] = [];
  const ne: string[] = [];
  en.push(
    `${typeLabel(spec.type, "en")} in ${where}, measuring ${formatAreaInput(areaInput, "en")} (${formatConverted(areaInput, "en", place.terai ? "TERAI" : "HILL")}).`,
  );
  ne.push(
    `${whereNe}मा ${formatAreaInput(areaInput, "ne")} (${formatConverted(areaInput, "ne", place.terai ? "TERAI" : "HILL")}) क्षेत्रफलको ${typeLabel(spec.type, "ne")}।`,
  );
  if (hasRoadInfo) {
    const dist = mainRoadDistanceM === 0 ? "right on the main road" : `${mainRoadDistanceM} m from the main road`;
    const distNe = mainRoadDistanceM === 0 ? "मुख्य सडकमै" : `मुख्य सडकबाट ${n(mainRoadDistanceM)} मिटर`;
    en.push(`It faces ${FACING_LABEL[facing].en} and has access by a ${roadWidthFt} ft ${ROAD_LABEL[roadType].en} road, ${dist}.`);
    ne.push(`${FACING_LABEL[facing].ne} मोहडा, ${n(roadWidthFt)} फिट ${ROAD_LABEL[roadType].ne} बाटो, ${distNe}।`);
  }
  if (isResidential && beds) {
    const fl = floors ? `${floors} floors, ` : "";
    const flNe = floors ? `${n(floors)} तला, ` : "";
    en.push(`${fl}${beds} bedrooms, ${bathrooms} bathrooms and parking for ${parking} vehicle${parking === 1 ? "" : "s"}; ${FURN_LABEL[furnishing].en}.`);
    ne.push(`${flNe}${n(beds)} शयनकक्ष, ${n(bathrooms ?? 1)} बाथरुम र ${n(parking ?? 0)} सवारी पार्किङ; ${FURN_LABEL[furnishing].ne}।`);
  } else if (isBuilt) {
    en.push(`${spec.size.toLocaleString("en-IN")} sq ft of usable space${floors ? ` across ${floors} floors` : ""}; ${FURN_LABEL[furnishing].en}.`);
    ne.push(`${n(spec.size.toLocaleString("en-IN"))} वर्ग फिट प्रयोगयोग्य स्थान${floors ? `, ${n(floors)} तलामा` : ""}; ${FURN_LABEL[furnishing].ne}।`);
  } else {
    en.push("Clear title (lalpurja), ready for registration.");
    ne.push("स्पष्ट लालपुर्जा, पास गर्न तयार।");
  }
  en.push(`Listing code ${code}. Call or WhatsApp MantraSphere to arrange a site visit.`);
  ne.push(`सूची कोड ${code}। साइट भ्रमणका लागि मन्त्रास्फियरलाई फोन वा ह्वाट्सएप गर्नुहोस्।`);

  // ---- images ----
  const alt = `${titleEn}`;
  const images = opts.images.map((img, i) => ({
    url: img.url,
    sizes: img.sizes,
    width: img.width,
    height: img.height,
    blurDataURL: img.blurDataURL,
    alt: img.room ? `${alt} – ${img.room}`.slice(0, 160) : suggestAlt(alt, place.area, i),
    order: i,
    isCover: i === 0,
  }));

  // ---- dates ----
  const daysAgo = (index * 2 + Math.floor(r() * 3)) % 60;
  const createdAt = new Date(now.getTime() - daysAgo * 86_400_000 - Math.floor(r() * 36e5));
  const status = spec.status ?? "ACTIVE";
  const expiresAt = opts.planDurationDays ? new Date(createdAt.getTime() + opts.planDurationDays * 86_400_000) : null;
  const soldAt = status === "SOLD" || status === "RENTED" ? new Date(now.getTime() - (index % 10) * 86_400_000) : undefined;

  const jitter = () => (r() - 0.5) * 0.012;
  const slug = propertySlug(titleEn, code);

  return {
    code,
    slug,
    title: { en: titleEn, ne: titleNe },
    description: { en: en.join(" "), ne: ne.join(" ") },
    purpose: spec.purpose,
    type: spec.type,
    status,
    priceNpr,
    priceOnRequest: !!spec.onRequest,
    priceUnit,
    negotiable: index % 3 === 0,
    areaSqFt,
    areaInput,
    builtUpAreaSqFt,
    ...(hasRoadInfo ? { facing, roadWidthFt, roadType, mainRoadDistanceM } : {}),
    ...(isResidential || spec.type === "COMMERCIAL" || spec.type === "OFFICE" ? { floors } : {}),
    ...(isResidential ? { bedrooms: beds, kitchens: 1, livingRooms: spec.type === "FLAT" ? 1 : 2 } : {}),
    ...(spec.type !== "LAND" ? { bathrooms, parking, furnishing, readyToMove: true } : {}),
    ...(spec.type === "HOUSE" || spec.type === "BUNGALOW" ? { builtYear: 2016 + (index % 8) } : {}),
    ...(hasPlot ? { ownershipType: "LALPURJA_SINGLE" } : {}),
    images,
    amenities:
      spec.type === "LAND"
        ? ["electricity", "drinking-water"]
        : ["drinking-water", "electricity", "sewerage", "internet", ...(isResidential ? ["solar", "balcony"] : ["backup-power", "cctv"])],
    nearby: [], // real nearby places are entered by owners/staff; demo data does not invent them
    location: { type: "Point", coordinates: [place.lng + jitter(), place.lat + jitter()] },
    province: loc.province._id,
    district: loc.district._id,
    municipality: loc.municipality._id,
    address: place.area,
    locationNames: ln,
    owner: opts.ownerId,
    postedBy: "COMPANY",
    contactName: "MantraSphere Real Estate",
    contactPhone: opts.phones[index % opts.phones.length],
    whatsapp: opts.phones[0],
    viber: opts.phones[0],
    tier: spec.tier,
    tierRank: TIER_RANK[spec.tier],
    expiresAt,
    publishedAt: createdAt,
    soldAt,
    views: Math.floor(r() * 900) + 20,
    searchKeywords: buildSearchKeywords([
      place.area, place.areaNe, ln.municipality.en, ln.municipality.ne, ln.district.en, ln.district.ne,
      ln.province.en, typeLabel(spec.type, "en"), typeLabel(spec.type, "ne"), code,
    ]),
    isDemo: true,
    createdAt,
    updatedAt: createdAt,
    scene: SCENE_FOR_TYPE[spec.type],
  };
}
