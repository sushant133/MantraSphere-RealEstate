import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";
import { ROLES } from "@/lib/constants";

/**
 * Users share the `users` collection with the Auth.js MongoDB adapter
 * (which also manages `accounts`, `sessions`, `verification_tokens`).
 */
const UserSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 80 },
    email: { type: String, lowercase: true, trim: true },
    emailVerified: Date,
    phone: { type: String, match: /^\+\d{7,15}$/ }, // E.164
    phoneVerified: Date,
    passwordHash: { type: String, select: false },
    image: String,
    role: { type: String, enum: ROLES, default: "USER", required: true },
    verified: { type: Boolean, default: false }, // verification badge (doc reviewed by admin)
    locale: { type: String, enum: ["en", "ne"], default: "en" },
    disabled: { type: Boolean, default: false },
    lastLoginAt: Date,
    passwordChangedAt: Date, // sessions issued before this are rejected
  },
  { timestamps: true, collection: "users" },
);
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
UserSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
UserSchema.index({ role: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export const User: Model<UserDoc> = (models.User as Model<UserDoc>) ?? model<UserDoc>("User", UserSchema);

const AgentProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["INDIVIDUAL_OWNER", "AGENT", "AGENCY"], required: true },
    agencyName: { type: String, trim: true, maxlength: 120 },
    bio: { en: String, ne: String },
    documents: [
      {
        kind: { type: String, enum: ["CITIZENSHIP", "AGENCY_REGISTRATION", "PAN", "OTHER"] },
        url: String, // private storage key, never public
        uploadedAt: Date,
      },
    ],
    verificationStatus: { type: String, enum: ["NONE", "PENDING", "APPROVED", "REJECTED"], default: "NONE" },
    verificationNote: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    whatsapp: String,
    viber: String,
  },
  { timestamps: true },
);
AgentProfileSchema.index({ user: 1 }, { unique: true });
AgentProfileSchema.index({ verificationStatus: 1 });

export type AgentProfileDoc = InferSchemaType<typeof AgentProfileSchema> & { _id: Types.ObjectId };
export const AgentProfile: Model<AgentProfileDoc> =
  (models.AgentProfile as Model<AgentProfileDoc>) ?? model<AgentProfileDoc>("AgentProfile", AgentProfileSchema);
