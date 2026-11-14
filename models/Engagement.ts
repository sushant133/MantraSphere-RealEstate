import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";

/** Leads, saved items, saved searches and listing reports. */

const LeadSchema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: "Property" },
    propertyCode: String,
    owner: { type: Schema.Types.ObjectId, ref: "User" }, // who receives the lead
    user: { type: Schema.Types.ObjectId, ref: "User" }, // logged-in sender, if any
    source: { type: String, enum: LEAD_SOURCES, required: true },
    name: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, match: /^\+\d{7,15}$/ },
    email: { type: String, lowercase: true, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: LEAD_STATUSES, default: "NEW" },
    ipHash: String, // salted hash, never the raw IP
  },
  { timestamps: true },
);
LeadSchema.index({ owner: 1, status: 1, createdAt: -1 });
LeadSchema.index({ property: 1, createdAt: -1 });
LeadSchema.index({ createdAt: -1 });

export type LeadDoc = InferSchemaType<typeof LeadSchema> & { _id: Types.ObjectId };
export const Lead: Model<LeadDoc> = (models.Lead as Model<LeadDoc>) ?? model<LeadDoc>("Lead", LeadSchema);

const SavedPropertySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
  },
  { timestamps: true },
);
SavedPropertySchema.index({ user: 1, property: 1 }, { unique: true });

export type SavedPropertyDoc = InferSchemaType<typeof SavedPropertySchema> & { _id: Types.ObjectId };
export const SavedProperty: Model<SavedPropertyDoc> =
  (models.SavedProperty as Model<SavedPropertyDoc>) ?? model<SavedPropertyDoc>("SavedProperty", SavedPropertySchema);

const SavedSearchSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, trim: true, maxlength: 80 },
    query: { type: String, required: true, maxlength: 1000 }, // canonical URL query string
    channels: { type: [String], enum: ["EMAIL", "SMS"], default: ["EMAIL"] },
    frequency: { type: String, enum: ["INSTANT", "DAILY", "WEEKLY"], default: "DAILY" },
    lastNotifiedAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
SavedSearchSchema.index({ user: 1 });
SavedSearchSchema.index({ active: 1, frequency: 1, lastNotifiedAt: 1 });

export type SavedSearchDoc = InferSchemaType<typeof SavedSearchSchema> & { _id: Types.ObjectId };
export const SavedSearch: Model<SavedSearchDoc> =
  (models.SavedSearch as Model<SavedSearchDoc>) ?? model<SavedSearchDoc>("SavedSearch", SavedSearchSchema);

const ReportSchema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, enum: ["SOLD", "WRONG_INFO", "DUPLICATE", "FRAUD", "OTHER"], required: true },
    details: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["OPEN", "RESOLVED", "DISMISSED"], default: "OPEN" },
  },
  { timestamps: true },
);
ReportSchema.index({ status: 1, createdAt: -1 });

export type ReportDoc = InferSchemaType<typeof ReportSchema> & { _id: Types.ObjectId };
export const Report: Model<ReportDoc> =
  (models.Report as Model<ReportDoc>) ?? model<ReportDoc>("Report", ReportSchema);
