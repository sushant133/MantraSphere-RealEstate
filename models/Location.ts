import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";

/** Province → District → Municipality, seeded from data/nepal-locations.json. */

const NameSchema = new Schema(
  { en: { type: String, required: true, trim: true }, ne: { type: String, required: true, trim: true } },
  { _id: false },
);

const ProvinceSchema = new Schema(
  {
    refId: { type: Number, required: true }, // source dataset id
    slug: { type: String, required: true },
    name: { type: NameSchema, required: true },
    headquarter: String,
  },
  { timestamps: true },
);
ProvinceSchema.index({ slug: 1 }, { unique: true });
ProvinceSchema.index({ refId: 1 }, { unique: true });

const DistrictSchema = new Schema(
  {
    refId: { type: Number, required: true },
    slug: { type: String, required: true },
    name: { type: NameSchema, required: true },
    province: { type: Schema.Types.ObjectId, ref: "Province", required: true },
    headquarter: String,
    region: { type: String, enum: ["HILL", "TERAI", "MOUNTAIN"], default: "HILL" }, // default area unit hint
    center: { type: [Number], default: undefined }, // [lng, lat]
    listingCount: { type: Number, default: 0 }, // denormalised for "Browse by district"
  },
  { timestamps: true },
);
DistrictSchema.index({ slug: 1 }, { unique: true });
DistrictSchema.index({ refId: 1 }, { unique: true });
DistrictSchema.index({ province: 1 });

const MunicipalitySchema = new Schema(
  {
    refId: { type: Number, required: true },
    slug: { type: String, required: true },
    name: { type: NameSchema, required: true },
    district: { type: Schema.Types.ObjectId, ref: "District", required: true },
    category: {
      type: String,
      enum: ["METROPOLITAN", "SUB_METROPOLITAN", "MUNICIPALITY", "RURAL_MUNICIPALITY"],
      required: true,
    },
    wards: { type: Number, min: 0 },
    areas: { type: [String], default: [] }, // popular tole/area names, admin-editable
  },
  { timestamps: true },
);
MunicipalitySchema.index({ slug: 1 }, { unique: true });
MunicipalitySchema.index({ refId: 1 }, { unique: true });
MunicipalitySchema.index({ district: 1, "name.en": 1 });

export type ProvinceDoc = InferSchemaType<typeof ProvinceSchema> & { _id: Types.ObjectId };
export type DistrictDoc = InferSchemaType<typeof DistrictSchema> & { _id: Types.ObjectId };
export type MunicipalityDoc = InferSchemaType<typeof MunicipalitySchema> & { _id: Types.ObjectId };

export const Province: Model<ProvinceDoc> =
  (models.Province as Model<ProvinceDoc>) ?? model<ProvinceDoc>("Province", ProvinceSchema);
export const District: Model<DistrictDoc> =
  (models.District as Model<DistrictDoc>) ?? model<DistrictDoc>("District", DistrictSchema);
export const Municipality: Model<MunicipalityDoc> =
  (models.Municipality as Model<MunicipalityDoc>) ?? model<MunicipalityDoc>("Municipality", MunicipalitySchema);
