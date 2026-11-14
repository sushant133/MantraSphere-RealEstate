/** Shared enums used by Zod schemas, Mongoose models and the UI. */

export const LOCALES = ["en", "ne"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const PURPOSES = ["SALE", "RENT", "LEASE"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const PROPERTY_TYPES = [
  "HOUSE",
  "LAND",
  "FLAT",
  "BUNGALOW",
  "COMMERCIAL",
  "OFFICE",
  "SHOP",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "SOLD",
  "RENTED",
  "EXPIRED",
  "REJECTED",
  "DELETED",
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

/** Statuses visible on public pages. */
export const PUBLIC_STATUSES: PropertyStatus[] = ["ACTIVE", "SOLD", "RENTED"];
export const CLOSED_STATUSES: PropertyStatus[] = ["SOLD", "RENTED"];

export const TIERS = ["NORMAL", "PREMIUM", "LATEST", "TOP", "HIGHLIGHT"] as const;
export type Tier = (typeof TIERS)[number];
/** Higher rank sorts first. */
export const TIER_RANK: Record<Tier, number> = {
  NORMAL: 0,
  PREMIUM: 10,
  LATEST: 20,
  TOP: 30,
  HIGHLIGHT: 40,
};

export const FACINGS = [
  "EAST",
  "WEST",
  "NORTH",
  "SOUTH",
  "NORTH_EAST",
  "NORTH_WEST",
  "SOUTH_EAST",
  "SOUTH_WEST",
] as const;
export const ROAD_TYPES = ["BLACKTOPPED", "PAVED", "GRAVELLED", "SOIL", "NO_ROAD"] as const;
export const FURNISHINGS = ["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"] as const;
export const OWNERSHIP_TYPES = ["LALPURJA_SINGLE", "LALPURJA_JOINT", "GUTHI", "COMPANY", "OTHER"] as const;

export const ROLES = ["ADMIN", "STAFF", "AGENT", "OWNER", "USER"] as const;
export type Role = (typeof ROLES)[number];

export const LEAD_STATUSES = ["NEW", "CONTACTED", "CLOSED"] as const;
export const LEAD_SOURCES = ["ENQUIRY_FORM", "SHOW_NUMBER", "CALL", "WHATSAPP", "VIBER", "CONTACT_PAGE"] as const;

export const PAYMENT_PROVIDERS = ["ESEWA", "KHALTI", "BANK_TRANSFER", "MOCK"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export const PAYMENT_STATUSES = ["INITIATED", "PENDING_VERIFICATION", "COMPLETED", "FAILED", "REFUNDED"] as const;

/** Which detail fields apply to which property type (fix #22: no "0 0 0 0" on land). */
export const TYPE_FIELDS: Record<PropertyType, readonly string[]> = {
  LAND: ["facing", "roadWidthFt", "roadType", "mainRoadDistanceM", "ownershipType"],
  HOUSE: [
    "facing", "roadWidthFt", "roadType", "mainRoadDistanceM", "floors", "bedrooms", "bathrooms",
    "kitchens", "livingRooms", "parking", "furnishing", "builtYear", "readyToMove", "ownershipType",
  ],
  BUNGALOW: [
    "facing", "roadWidthFt", "roadType", "mainRoadDistanceM", "floors", "bedrooms", "bathrooms",
    "kitchens", "livingRooms", "parking", "furnishing", "builtYear", "readyToMove", "ownershipType",
  ],
  FLAT: ["floors", "bedrooms", "bathrooms", "kitchens", "livingRooms", "parking", "furnishing", "builtYear", "readyToMove"],
  COMMERCIAL: ["facing", "roadWidthFt", "roadType", "mainRoadDistanceM", "floors", "bathrooms", "parking", "furnishing", "builtYear", "readyToMove"],
  OFFICE: ["floors", "bathrooms", "parking", "furnishing", "readyToMove"],
  SHOP: ["roadWidthFt", "roadType", "mainRoadDistanceM", "bathrooms", "parking", "furnishing", "readyToMove"],
};

/** Card projection: only what a listing card needs (used with `.select().lean()`). */
export const PROPERTY_CARD_FIELDS =
  "code slug title purpose type status priceNpr priceOnRequest priceUnit negotiable areaSqFt areaInput " +
  "bedrooms bathrooms parking facing roadWidthFt locationNames tier tierRank images createdAt soldAt";
