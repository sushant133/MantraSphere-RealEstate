import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";

/** Site settings (single document), audit log and slug redirects. */

const SiteSettingSchema = new Schema(
  {
    _id: { type: String, default: "site" }, // singleton
    companyName: { en: String, ne: String },
    legalName: String,
    registrationNo: String,
    panNo: String,
    address: { en: String, ne: String },
    geo: { lat: Number, lng: Number },
    phones: { type: [String], default: [] }, // E.164
    whatsapp: String,
    viber: String,
    email: String,
    officeHours: { en: String, ne: String },
    social: {
      facebook: String,
      instagram: String,
      youtube: String,
      tiktok: String,
      linkedin: String,
    },
    loanRates: [{ bank: String, ratePct: Number, updatedAt: Date }],
    bankAccounts: [{ bank: String, accountName: String, accountNumber: String, branch: String }],
    about: { en: String, ne: String },
    team: [{ name: String, role: { en: String, ne: String }, photo: String, order: Number }],
  },
  { timestamps: true, collection: "sitesettings" },
);
export type SiteSettingDoc = InferSchemaType<typeof SiteSettingSchema>;
export const SiteSetting: Model<SiteSettingDoc> =
  (models.SiteSetting as Model<SiteSettingDoc>) ?? model<SiteSettingDoc>("SiteSetting", SiteSettingSchema);

const AuditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. "property.approve"
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ipHash: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });
export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema> & { _id: Types.ObjectId };
export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ?? model<AuditLogDoc>("AuditLog", AuditLogSchema);

/** Old slug → current slug, served as 301 (fix #23). */
const SlugRedirectSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    entity: { type: String, enum: ["property", "blog"], default: "property" },
  },
  { timestamps: true },
);
SlugRedirectSchema.index({ entity: 1, from: 1 }, { unique: true });
export type SlugRedirectDoc = InferSchemaType<typeof SlugRedirectSchema> & { _id: Types.ObjectId };
export const SlugRedirect: Model<SlugRedirectDoc> =
  (models.SlugRedirect as Model<SlugRedirectDoc>) ?? model<SlugRedirectDoc>("SlugRedirect", SlugRedirectSchema);
