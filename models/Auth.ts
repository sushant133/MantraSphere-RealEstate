import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";

/** One-time login codes sent by SMS. Codes are stored hashed and expire via TTL. */
const OtpSchema = new Schema(
  {
    phone: { type: String, required: true, match: /^\+\d{7,15}$/ },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
OtpSchema.index({ phone: 1 });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpDoc = InferSchemaType<typeof OtpSchema> & { _id: Types.ObjectId };
export const Otp: Model<OtpDoc> = (models.Otp as Model<OtpDoc>) ?? model<OtpDoc>("Otp", OtpSchema);

/** Email verification and password-reset tokens (hashed, single use, TTL). */
const AuthTokenSchema = new Schema(
  {
    kind: { type: String, enum: ["EMAIL_VERIFY", "PASSWORD_RESET"], required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AuthTokenSchema.index({ tokenHash: 1 }, { unique: true });
AuthTokenSchema.index({ user: 1, kind: 1 });
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthTokenDoc = InferSchemaType<typeof AuthTokenSchema> & { _id: Types.ObjectId };
export const AuthToken: Model<AuthTokenDoc> =
  (models.AuthToken as Model<AuthTokenDoc>) ?? model<AuthTokenDoc>("AuthToken", AuthTokenSchema);
