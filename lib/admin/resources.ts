import { z } from "zod";
import { PROPERTY_TYPES, TIERS } from "@/lib/constants";
import type { Permission } from "./auth";

/**
 * Config-driven admin CRUD. One definition per resource drives the list
 * page, the edit form and the server-side Zod validation. Client-safe (no
 * model imports); the model registry lives in ./registry.ts.
 */

type Opt = { value: string; label: string };
export type FieldDef = { key: string; label: string; help?: string } & (
  | { type: "text" | "textarea" | "markdown" | "url" | "slug"; required?: boolean; max?: number }
  | { type: "i18n" | "i18nTextarea"; requiredEn?: boolean; max?: number }
  | { type: "number"; min?: number; max?: number; integer?: boolean; required?: boolean }
  | { type: "boolean" }
  | { type: "select"; options: Opt[]; nullable?: boolean }
  | { type: "multiselect"; options: Opt[] }
  | { type: "date" }
  | { type: "stringList"; max?: number }
  | { type: "i18nList" }
  | { type: "image" }
);

export type Column = { key: string; label: string; format?: "i18n" | "bool" | "npr" | "date" | "list" };

export type ResourceDef = {
  key: string;
  label: string;
  singular: string;
  perm: Permission;
  /** Cache tag revalidated after changes. */
  tag: string;
  create: boolean;
  remove: boolean;
  columns: Column[];
  search: string[];
  sort: Record<string, 1 | -1>;
  fields: FieldDef[];
};

const tierOpts = TIERS.map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }));
const typeOpts = PROPERTY_TYPES.map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }));

export const RESOURCES: ResourceDef[] = [
  {
    key: "plans", label: "Plans", singular: "plan", perm: "plans", tag: "plans", create: true, remove: false,
    columns: [{ key: "name", label: "Name", format: "i18n" }, { key: "priceNpr", label: "Price", format: "npr" }, { key: "durationDays", label: "Days" }, { key: "tier", label: "Tier" }, { key: "active", label: "Active", format: "bool" }],
    search: ["slug", "name.en"], sort: { sortWeight: 1 },
    fields: [
      { key: "slug", label: "Slug", type: "slug", required: true },
      { key: "name", label: "Name", type: "i18n", requiredEn: true, max: 60 },
      { key: "tier", label: "Tier (placement)", type: "select", options: tierOpts },
      { key: "priceNpr", label: "Price (NPR)", type: "number", min: 0, max: 10_000_000, integer: true, required: true },
      { key: "durationDays", label: "Duration in days", help: "Leave empty for “until sold”.", type: "number", min: 1, max: 3650, integer: true },
      { key: "homepageSection", label: "Home page section", type: "select", options: tierOpts.filter((t) => t.value !== "NORMAL"), nullable: true },
      { key: "facebookPromotionDays", label: "Facebook promotion days", type: "number", min: 0, max: 365, integer: true },
      { key: "videoIncluded", label: "Professional video included", type: "boolean" },
      { key: "maxPhotos", label: "Max photos", type: "number", min: 1, max: 30, integer: true, required: true },
      { key: "sortWeight", label: "Sort weight", type: "number", min: -1000, max: 1000, integer: true },
      { key: "features", label: "Features (one per line)", type: "i18nList" },
      { key: "active", label: "Available for purchase", type: "boolean" },
    ],
  },
  {
    key: "amenities", label: "Amenities", singular: "amenity", perm: "content", tag: "amenities", create: true, remove: true,
    columns: [{ key: "name", label: "Name", format: "i18n" }, { key: "slug", label: "Slug" }, { key: "appliesTo", label: "Applies to", format: "list" }],
    search: ["slug", "name.en", "name.ne"], sort: { order: 1 },
    fields: [
      { key: "slug", label: "Slug", type: "slug", required: true },
      { key: "name", label: "Name", type: "i18n", requiredEn: true, max: 60 },
      { key: "icon", label: "Icon name (lucide)", type: "text", max: 40 },
      { key: "appliesTo", label: "Applies to (empty = all types)", type: "multiselect", options: typeOpts },
      { key: "order", label: "Order", type: "number", integer: true, min: 0, max: 1000 },
    ],
  },
  {
    key: "faqs", label: "FAQ", singular: "question", perm: "content", tag: "faqs", create: true, remove: true,
    columns: [{ key: "question", label: "Question", format: "i18n" }, { key: "category", label: "Category" }, { key: "active", label: "Active", format: "bool" }],
    search: ["question.en", "question.ne"], sort: { category: 1, order: 1 },
    fields: [
      { key: "question", label: "Question", type: "i18n", requiredEn: true, max: 200 },
      { key: "answer", label: "Answer", type: "i18nTextarea", requiredEn: true, max: 3000 },
      { key: "category", label: "Category", type: "select", options: ["GENERAL", "PRICING", "LISTING", "PAYMENT"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() })) },
      { key: "order", label: "Order", type: "number", integer: true, min: 0, max: 1000 },
      { key: "active", label: "Published", type: "boolean" },
    ],
  },
  {
    key: "testimonials", label: "Testimonials", singular: "testimonial", perm: "content", tag: "testimonials", create: true, remove: true,
    columns: [{ key: "name", label: "Name" }, { key: "quote", label: "Quote", format: "i18n" }, { key: "active", label: "Shown", format: "bool" }],
    search: ["name", "quote.en"], sort: { order: 1 },
    fields: [
      { key: "name", label: "Client name", type: "text", required: true, max: 80, help: "Only publish real testimonials with the client's permission." },
      { key: "role", label: "Role / place", type: "i18n", max: 80 },
      { key: "quote", label: "Quote", type: "i18nTextarea", requiredEn: true, max: 600 },
      { key: "rating", label: "Rating (1–5)", type: "number", min: 1, max: 5, integer: true },
      { key: "order", label: "Order", type: "number", integer: true, min: 0, max: 1000 },
      { key: "active", label: "Show on home page", type: "boolean" },
    ],
  },
  {
    key: "banners", label: "Banners", singular: "banner", perm: "content", tag: "banners", create: true, remove: true,
    columns: [{ key: "title", label: "Title", format: "i18n" }, { key: "placement", label: "Placement" }, { key: "active", label: "Active", format: "bool" }, { key: "endsAt", label: "Ends", format: "date" }],
    search: ["title.en"], sort: { placement: 1, order: 1 },
    fields: [
      { key: "title", label: "Title", type: "i18n", requiredEn: true, max: 120 },
      { key: "image", label: "Image", type: "image" },
      { key: "href", label: "Link (path or https URL)", type: "url" },
      { key: "placement", label: "Placement", type: "select", options: ["HOME_HERO", "HOME_MID", "LISTING_SIDEBAR"].map((v) => ({ value: v, label: v })) },
      { key: "startsAt", label: "Starts", type: "date" },
      { key: "endsAt", label: "Ends", type: "date" },
      { key: "order", label: "Order", type: "number", integer: true, min: 0, max: 1000 },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "blog", label: "Blog posts", singular: "post", perm: "content", tag: "blog", create: true, remove: true,
    columns: [{ key: "title", label: "Title", format: "i18n" }, { key: "status", label: "Status" }, { key: "publishedAt", label: "Published", format: "date" }],
    search: ["title.en", "title.ne", "slug"], sort: { updatedAt: -1 },
    fields: [
      { key: "slug", label: "Slug", type: "slug", required: true },
      { key: "title", label: "Title", type: "i18n", requiredEn: true, max: 140 },
      { key: "excerpt", label: "Excerpt (used as meta description)", type: "i18nTextarea", max: 300 },
      { key: "body", label: "Body (Markdown)", type: "i18nTextarea", max: 50_000 },
      { key: "coverImage", label: "Cover image", type: "image" },
      { key: "tags", label: "Tags (one per line)", type: "stringList", max: 20 },
      { key: "status", label: "Status", type: "select", options: [{ value: "DRAFT", label: "Draft" }, { value: "PUBLISHED", label: "Published" }] },
      { key: "publishedAt", label: "Publish date", type: "date" },
    ],
  },
  {
    key: "pages", label: "Legal pages", singular: "page", perm: "content", tag: "pages", create: false, remove: false,
    columns: [{ key: "title", label: "Title", format: "i18n" }, { key: "slug", label: "Slug" }, { key: "updatedAt", label: "Updated", format: "date" }],
    search: ["title.en", "slug"], sort: { slug: 1 },
    fields: [
      { key: "title", label: "Title", type: "i18n", requiredEn: true, max: 120 },
      { key: "summary", label: "Summary (meta description)", type: "i18nTextarea", max: 300 },
      { key: "body", label: "Body (Markdown)", type: "i18nTextarea", requiredEn: true, max: 50_000, help: "Have a lawyer review changes. The page shows the date of the last save." },
    ],
  },
  {
    key: "districts", label: "Districts", singular: "district", perm: "content", tag: "locations", create: false, remove: false,
    columns: [{ key: "name", label: "Name", format: "i18n" }, { key: "region", label: "Region" }, { key: "listingCount", label: "Listings" }],
    search: ["name.en", "name.ne", "slug"], sort: { "name.en": 1 },
    fields: [
      { key: "name", label: "Name", type: "i18n", requiredEn: true, max: 60 },
      { key: "region", label: "Default land unit region", type: "select", options: [{ value: "HILL", label: "Hill (ropani-aana)" }, { value: "TERAI", label: "Terai (bigha-kattha)" }, { value: "MOUNTAIN", label: "Mountain" }] },
      { key: "centerLat", label: "Map centre latitude", type: "number", min: 26, max: 31 },
      { key: "centerLng", label: "Map centre longitude", type: "number", min: 79, max: 89 },
    ],
  },
  {
    key: "municipalities", label: "Local levels", singular: "local level", perm: "content", tag: "locations", create: false, remove: false,
    columns: [{ key: "name", label: "Name", format: "i18n" }, { key: "category", label: "Category" }, { key: "wards", label: "Wards" }],
    search: ["name.en", "name.ne", "slug"], sort: { "name.en": 1 },
    fields: [
      { key: "name", label: "Name", type: "i18n", requiredEn: true, max: 80 },
      { key: "wards", label: "Number of wards", type: "number", min: 1, max: 40, integer: true },
      { key: "areas", label: "Popular areas / toles (one per line)", type: "stringList", max: 200 },
    ],
  },
];

export const getResource = (key: string) => RESOURCES.find((r) => r.key === key) ?? null;

// ---- Validation -----------------------------------------------------------------------------

const imageSchema = z.object({ url: z.string().regex(/^\/uploads\/cms\/[a-z0-9-]+\.webp$/), alt: z.string().trim().max(160), width: z.number().int().positive(), height: z.number().int().positive() });

/** Zod schema for a resource's form values (all keys present; empty = null). */
export function schemaFor(def: ResourceDef) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of def.fields) {
    switch (f.type) {
      case "text":
      case "textarea":
      case "markdown":
        shape[f.key] = f.required ? z.string().trim().min(1).max(f.max ?? 5000) : z.string().trim().max(f.max ?? 5000);
        break;
      case "slug":
        shape[f.key] = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
        break;
      case "url":
        shape[f.key] = z.union([z.literal(""), z.string().regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/).max(500)]);
        break;
      case "i18n":
      case "i18nTextarea":
        shape[f.key] = z.object({
          en: f.requiredEn ? z.string().trim().min(1).max(f.max ?? 5000) : z.string().trim().max(f.max ?? 5000),
          ne: z.string().trim().max(f.max ?? 5000),
        });
        break;
      case "number": {
        let n = z.number().finite();
        if (f.integer) n = n.int();
        if (f.min != null) n = n.min(f.min);
        if (f.max != null) n = n.max(f.max);
        shape[f.key] = f.required ? n : n.nullable();
        break;
      }
      case "boolean":
        shape[f.key] = z.boolean();
        break;
      case "select":
        shape[f.key] = f.nullable
          ? z.enum(f.options.map((o) => o.value) as [string, ...string[]]).nullable()
          : z.enum(f.options.map((o) => o.value) as [string, ...string[]]);
        break;
      case "multiselect":
        shape[f.key] = z.array(z.enum(f.options.map((o) => o.value) as [string, ...string[]])).max(f.options.length);
        break;
      case "date":
        shape[f.key] = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
        break;
      case "stringList":
        shape[f.key] = z.array(z.string().trim().min(1).max(200)).max(f.max ?? 100);
        break;
      case "i18nList":
        shape[f.key] = z.object({ en: z.array(z.string().trim().min(1).max(200)).max(30), ne: z.array(z.string().trim().min(1).max(200)).max(30) });
        break;
      case "image":
        shape[f.key] = imageSchema.nullable();
        break;
    }
  }
  return z.object(shape);
}
