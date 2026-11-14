import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";

/** CMS-style content: amenities, blog, banners, testimonials, FAQ. */

const i18n = (required = false) => ({
  en: { type: String, trim: true, required },
  ne: { type: String, trim: true, default: "" },
});

const AmenitySchema = new Schema(
  {
    slug: { type: String, required: true },
    name: i18n(true),
    icon: { type: String, default: "check" }, // lucide icon name
    appliesTo: { type: [String], default: [] }, // property types; empty = all
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
AmenitySchema.index({ slug: 1 }, { unique: true });
export type AmenityDoc = InferSchemaType<typeof AmenitySchema> & { _id: Types.ObjectId };
export const Amenity: Model<AmenityDoc> =
  (models.Amenity as Model<AmenityDoc>) ?? model<AmenityDoc>("Amenity", AmenitySchema);

const BlogPostSchema = new Schema(
  {
    slug: { type: String, required: true },
    title: i18n(true),
    excerpt: i18n(),
    body: i18n(), // MDX/Markdown
    coverImage: { url: String, alt: String, width: Number, height: Number },
    author: { type: Schema.Types.ObjectId, ref: "User" },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
    publishedAt: Date,
  },
  { timestamps: true },
);
BlogPostSchema.index({ slug: 1 }, { unique: true });
BlogPostSchema.index({ status: 1, publishedAt: -1 });
export type BlogPostDoc = InferSchemaType<typeof BlogPostSchema> & { _id: Types.ObjectId };
export const BlogPost: Model<BlogPostDoc> =
  (models.BlogPost as Model<BlogPostDoc>) ?? model<BlogPostDoc>("BlogPost", BlogPostSchema);

const BannerSchema = new Schema(
  {
    title: i18n(true),
    image: { url: String, alt: String, width: Number, height: Number },
    href: String,
    placement: { type: String, enum: ["HOME_HERO", "HOME_MID", "LISTING_SIDEBAR"], required: true },
    startsAt: Date,
    endsAt: Date,
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
BannerSchema.index({ placement: 1, active: 1, order: 1 });
export type BannerDoc = InferSchemaType<typeof BannerSchema> & { _id: Types.ObjectId };
export const Banner: Model<BannerDoc> =
  (models.Banner as Model<BannerDoc>) ?? model<BannerDoc>("Banner", BannerSchema);

const TestimonialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: i18n(),
    quote: i18n(true),
    rating: { type: Number, min: 1, max: 5, default: 5 },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export type TestimonialDoc = InferSchemaType<typeof TestimonialSchema> & { _id: Types.ObjectId };
export const Testimonial: Model<TestimonialDoc> =
  (models.Testimonial as Model<TestimonialDoc>) ?? model<TestimonialDoc>("Testimonial", TestimonialSchema);

const FaqSchema = new Schema(
  {
    question: i18n(true),
    answer: i18n(true),
    category: { type: String, enum: ["GENERAL", "PRICING", "LISTING", "PAYMENT"], default: "GENERAL" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
FaqSchema.index({ category: 1, order: 1 });
export type FaqDoc = InferSchemaType<typeof FaqSchema> & { _id: Types.ObjectId };
export const Faq: Model<FaqDoc> = (models.Faq as Model<FaqDoc>) ?? model<FaqDoc>("Faq", FaqSchema);

/** Editable legal/info pages (privacy, terms). Body is Markdown. */
const StaticPageSchema = new Schema(
  {
    slug: { type: String, required: true, enum: ["privacy", "terms"] },
    title: i18n(true),
    summary: i18n(), // meta description
    body: i18n(true),
  },
  { timestamps: true },
);
StaticPageSchema.index({ slug: 1 }, { unique: true });
export type StaticPageDoc = InferSchemaType<typeof StaticPageSchema> & { _id: Types.ObjectId };
export const StaticPage: Model<StaticPageDoc> =
  (models.StaticPage as Model<StaticPageDoc>) ?? model<StaticPageDoc>("StaticPage", StaticPageSchema);
