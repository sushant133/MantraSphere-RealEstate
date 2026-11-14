import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";
import {
  FACINGS,
  FURNISHINGS,
  OWNERSHIP_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  PURPOSES,
  ROAD_TYPES,
  TIERS,
} from "@/lib/constants";
import { AREA_SYSTEMS } from "@/lib/units";
import { PRICE_UNITS, computeTotalPrice, isPriceOutlier } from "@/lib/price";

const i18nText = { en: { type: String, trim: true, default: "" }, ne: { type: String, trim: true, default: "" } };

const ImageSchema = new Schema(
  {
    url: { type: String, required: true }, // base path; variants at -400/-800/-1600
    sizes: {
      type: [{ width: Number, url: String, format: { type: String, enum: ["webp", "avif"] } }],
      default: [],
    },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    blurDataURL: { type: String, default: "" },
    alt: { type: String, required: true, trim: true, maxlength: 160 },
    order: { type: Number, default: 0 },
    isCover: { type: Boolean, default: false },
  },
  { _id: true },
);

const VideoSchema = new Schema(
  {
    kind: { type: String, enum: ["YOUTUBE", "TOUR_360"], required: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const NearbySchema = new Schema(
  {
    kind: { type: String, enum: ["SCHOOL", "HOSPITAL", "BUS_STOP", "MARKET", "TEMPLE", "BANK", "OTHER"], required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    distanceM: { type: Number, min: 0, max: 100_000 },
  },
  { _id: false },
);

const LocationNameSchema = new Schema({ en: String, ne: String, slug: String }, { _id: false });

const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (c: number[]) => c.length === 2 && c[0] >= 79 && c[0] <= 89 && c[1] >= 26 && c[1] <= 31,
        message: "Location must be inside Nepal",
      },
    },
  },
  { _id: false },
);

/** Required once the listing leaves DRAFT (drafts are saved step by step). */
function requiredUnlessDraft(this: { status?: string }) {
  return this.status !== "DRAFT";
}

const PropertySchema = new Schema(
  {
    code: { type: String, required: true, match: /^MSR-\d{6,}$/ },
    slug: { type: String, required: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    title: { ...i18nText, en: { type: String, required: requiredUnlessDraft, trim: true, maxlength: 140 } },
    titleLocked: { type: Boolean, default: false }, // true once staff edited the generated title
    description: i18nText,

    purpose: { type: String, enum: PURPOSES, required: true },
    type: { type: String, enum: PROPERTY_TYPES, required: true },
    status: { type: String, enum: PROPERTY_STATUSES, default: "DRAFT", required: true },
    rejectionReason: String,

    // Price: integer NPR, or "price on request". Never Rs 0.
    priceNpr: {
      type: Number,
      min: 1,
      max: 9e15,
      validate: { validator: (v: number | null) => v == null || Number.isSafeInteger(v), message: "Price must be an integer" },
      default: null,
    },
    priceOnRequest: { type: Boolean, default: false },
    priceUnit: { type: String, enum: PRICE_UNITS, default: "TOTAL" },
    negotiable: { type: Boolean, default: false },
    priceNeedsApproval: { type: Boolean, default: false },
    /** Derived: total NPR (per-unit prices × area; monthly for rent). Used for filters and sorting. */
    priceTotalNpr: { type: Number, default: null },

    // Area: canonical sq ft + the owner's original structured input.
    areaSqFt: { type: Number, min: 0 },
    areaInput: {
      system: { type: String, enum: AREA_SYSTEMS },
      values: { type: Schema.Types.Mixed },
    },
    builtUpAreaSqFt: { type: Number, min: 0 },

    facing: { type: String, enum: FACINGS },
    roadWidthFt: { type: Number, min: 0, max: 300 },
    roadType: { type: String, enum: ROAD_TYPES },
    mainRoadDistanceM: { type: Number, min: 0, max: 100_000 },
    floors: { type: Number, min: 0, max: 100 },
    bedrooms: { type: Number, min: 0, max: 100 },
    bathrooms: { type: Number, min: 0, max: 100 },
    kitchens: { type: Number, min: 0, max: 50 },
    livingRooms: { type: Number, min: 0, max: 50 },
    parking: { type: Number, min: 0, max: 500 }, // number of vehicles
    furnishing: { type: String, enum: FURNISHINGS },
    builtYear: { type: Number, min: 1900, max: 2200 }, // AD
    readyToMove: { type: Boolean },
    ownershipType: { type: String, enum: OWNERSHIP_TYPES },

    images: { type: [ImageSchema], default: [] },
    videos: { type: [VideoSchema], default: [] },
    amenities: { type: [String], default: [] },
    nearby: { type: [NearbySchema], default: [] },

    // Location
    // Absent until the owner drops a pin (a Point without coordinates breaks the 2dsphere index).
    location: { type: GeoPointSchema, default: undefined },
    province: { type: Schema.Types.ObjectId, ref: "Province", required: requiredUnlessDraft },
    district: { type: Schema.Types.ObjectId, ref: "District", required: requiredUnlessDraft },
    municipality: { type: Schema.Types.ObjectId, ref: "Municipality" },
    ward: { type: Number, min: 1, max: 40 },
    address: { type: String, trim: true, maxlength: 200, default: "" },
    locationNames: {
      province: LocationNameSchema,
      district: LocationNameSchema,
      municipality: LocationNameSchema,
    },

    // Contact (E.164)
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    agent: { type: Schema.Types.ObjectId, ref: "User" },
    postedBy: { type: String, enum: ["OWNER", "AGENT", "COMPANY"], default: "OWNER" },
    contactName: { type: String, required: requiredUnlessDraft, trim: true, maxlength: 80 },
    contactPhone: { type: String, required: requiredUnlessDraft, match: /^\+\d{7,15}$/ },
    whatsapp: { type: String, match: /^\+\d{7,15}$/ },
    viber: { type: String, match: /^\+\d{7,15}$/ },

    // Plan / placement
    tier: { type: String, enum: TIERS, default: "NORMAL" },
    tierRank: { type: Number, default: 0 },
    currentPlan: { type: Schema.Types.ObjectId, ref: "Plan" },
    featuredUntil: Date,
    expiresAt: Date,
    publishedAt: Date,
    soldAt: Date,
    deletedAt: Date,

    views: { type: Number, default: 0 },
    leadsCount: { type: Number, default: 0 },
    searchKeywords: { type: [String], default: [] },
    validationWarnings: { type: [String], default: [] },
    isDemo: { type: Boolean, default: false },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    requestedPlan: { type: Schema.Types.ObjectId, ref: "Plan" }, // chosen in the wizard; activated after payment (Phase 5) // seeded demo data; purge with `npm run seed -- --purge-demo`
  },
  { timestamps: true },
);

// A price is required unless "price on request" is set (fix #16).
PropertySchema.pre("validate", function (next) {
  if (this.status !== "DRAFT" && !this.priceOnRequest && (this.priceNpr == null || this.priceNpr <= 0)) {
    this.invalidate("priceNpr", "Price is required unless 'Price on request' is selected");
  }
  if (this.purpose === "RENT" && this.priceUnit !== "PER_MONTH") {
    this.priceUnit = "PER_MONTH"; // rent is always per month (fix #17)
  }
  this.priceTotalNpr = computeTotalPrice(this);
  this.priceNeedsApproval = this.priceTotalNpr != null && isPriceOutlier(this.purpose, this.priceTotalNpr);
  if (this.type === "LAND" && this.status !== "DRAFT" && !(this.areaSqFt && this.areaSqFt > 0)) {
    this.invalidate("areaSqFt", "Land area must be greater than 0");
  }
  next();
});

// ---- Indexes ----
PropertySchema.index({ code: 1 }, { unique: true });
PropertySchema.index({ slug: 1 }, { unique: true });
PropertySchema.index({ status: 1, purpose: 1, type: 1, district: 1, priceTotalNpr: 1 });
PropertySchema.index({ status: 1, tierRank: -1, createdAt: -1 });
PropertySchema.index({ status: 1, expiresAt: 1 });
PropertySchema.index({ status: 1, soldAt: -1 });
PropertySchema.index({ status: 1, publishedAt: -1 }); // saved-search alerts
PropertySchema.index({ owner: 1, status: 1 });
PropertySchema.index({ location: "2dsphere" });
PropertySchema.index(
  {
    "title.en": "text",
    "title.ne": "text",
    searchKeywords: "text",
    address: "text",
    "description.en": "text",
    "description.ne": "text",
  },
  {
    name: "property_text",
    weights: { "title.en": 10, "title.ne": 10, searchKeywords: 8, address: 5, "description.en": 1, "description.ne": 1 },
    default_language: "none",
  },
);

export type PropertyDoc = InferSchemaType<typeof PropertySchema> & { _id: Types.ObjectId };
export const Property: Model<PropertyDoc> =
  (models.Property as Model<PropertyDoc>) ?? model<PropertyDoc>("Property", PropertySchema);
