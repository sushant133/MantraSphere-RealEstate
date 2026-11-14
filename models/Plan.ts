import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";
import { TIERS, PAYMENT_PROVIDERS, PAYMENT_STATUSES } from "@/lib/constants";

const PlanSchema = new Schema(
  {
    slug: { type: String, required: true },
    name: { en: { type: String, required: true }, ne: { type: String, required: true } },
    tier: { type: String, enum: TIERS, required: true },
    priceNpr: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    durationDays: { type: Number, min: 1, default: null }, // null = until sold
    homepageSection: { type: String, enum: [...TIERS, null], default: null },
    facebookPromotionDays: { type: Number, min: 0, default: 0 },
    videoIncluded: { type: Boolean, default: false },
    maxPhotos: { type: Number, min: 1, max: 50, default: 10 },
    sortWeight: { type: Number, default: 0 },
    features: { en: [String], ne: [String] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
PlanSchema.index({ slug: 1 }, { unique: true });

export type PlanDoc = InferSchemaType<typeof PlanSchema> & { _id: Types.ObjectId };
export const Plan: Model<PlanDoc> = (models.Plan as Model<PlanDoc>) ?? model<PlanDoc>("Plan", PlanSchema);

const SubscriptionSchema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment" },
    status: { type: String, enum: ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED"], default: "PENDING" },
    startsAt: Date,
    endsAt: Date, // null = until sold
    remindersSent: { type: [String], default: [] }, // "7d", "1d"
  },
  { timestamps: true },
);
SubscriptionSchema.index({ property: 1, status: 1 });
SubscriptionSchema.index({ status: 1, endsAt: 1 });
SubscriptionSchema.index({ user: 1, createdAt: -1 });

export type SubscriptionDoc = InferSchemaType<typeof SubscriptionSchema> & { _id: Types.ObjectId };
export const Subscription: Model<SubscriptionDoc> =
  (models.Subscription as Model<SubscriptionDoc>) ?? model<SubscriptionDoc>("Subscription", SubscriptionSchema);

const PaymentSchema = new Schema(
  {
    invoiceNo: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    property: { type: Schema.Types.ObjectId, ref: "Property" },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    amountNpr: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    /** NEW_LISTING: paid listing goes to review. RENEWAL: plan activates immediately. */
    purpose: { type: String, enum: ["NEW_LISTING", "RENEWAL"], required: true, default: "NEW_LISTING" },
    paidAt: Date,
    bankReference: { type: String, trim: true, maxlength: 80 },
    provider: { type: String, enum: PAYMENT_PROVIDERS }, // set when the owner picks a method
    status: { type: String, enum: PAYMENT_STATUSES, default: "INITIATED" },
    providerRef: String, // eSewa transaction_uuid / Khalti pidx
    providerTxnId: String,
    rawVerification: { type: Schema.Types.Mixed, select: false },
    bankSlipUrl: String,
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    failureReason: String,
  },
  { timestamps: true },
);
PaymentSchema.index({ invoiceNo: 1 }, { unique: true });
PaymentSchema.index({ provider: 1, providerRef: 1 }, { unique: true, partialFilterExpression: { providerRef: { $type: "string" } } });
PaymentSchema.index({ user: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ property: 1, status: 1 });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema> & { _id: Types.ObjectId };
export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc>) ?? model<PaymentDoc>("Payment", PaymentSchema);
