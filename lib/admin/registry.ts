import "server-only";
import type { Model } from "mongoose";
import { Amenity, Banner, BlogPost, District, Faq, Municipality, Plan, StaticPage, Testimonial } from "@/models";
import type { ResourceDef } from "./resources";

/** Resource key → Mongoose model, plus document ⇄ form conversion. */
export const MODELS: Record<string, () => Model<never>> = {
  plans: () => Plan as unknown as Model<never>,
  amenities: () => Amenity as unknown as Model<never>,
  faqs: () => Faq as unknown as Model<never>,
  testimonials: () => Testimonial as unknown as Model<never>,
  banners: () => Banner as unknown as Model<never>,
  blog: () => BlogPost as unknown as Model<never>,
  pages: () => StaticPage as unknown as Model<never>,
  districts: () => District as unknown as Model<never>,
  municipalities: () => Municipality as unknown as Model<never>,
};

type Doc = Record<string, unknown>;
const get = (o: Doc, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v as Doc | undefined)?.[k], o);
const isoDay = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : typeof d === "string" ? d.slice(0, 10) : null);

/** Database document → form values for every field (with sensible empties). */
export function toForm(def: ResourceDef, doc: Doc | null): Doc {
  const out: Doc = {};
  for (const f of def.fields) {
    const v = doc ? get(doc, f.key) : undefined;
    switch (f.type) {
      case "i18n":
      case "i18nTextarea":
        out[f.key] = { en: (v as Doc)?.en ?? "", ne: (v as Doc)?.ne ?? "" };
        break;
      case "i18nList":
        out[f.key] = { en: ((v as Doc)?.en as string[]) ?? [], ne: ((v as Doc)?.ne as string[]) ?? [] };
        break;
      case "number":
        out[f.key] = typeof v === "number" ? v : null;
        break;
      case "boolean":
        out[f.key] = doc ? !!v : f.key === "active";
        break;
      case "select":
        out[f.key] = (v as string) ?? (f.nullable ? null : f.options[0].value);
        break;
      case "multiselect":
      case "stringList":
        out[f.key] = (v as string[]) ?? [];
        break;
      case "date":
        out[f.key] = isoDay(v);
        break;
      case "image":
        out[f.key] = v && (v as Doc).url ? { url: (v as Doc).url, alt: (v as Doc).alt ?? "", width: (v as Doc).width ?? 1, height: (v as Doc).height ?? 1 } : null;
        break;
      default:
        out[f.key] = (v as string) ?? "";
    }
  }
  if (def.key === "districts" && doc) {
    const c = doc.center as number[] | undefined;
    out.centerLng = c?.[0] ?? null;
    out.centerLat = c?.[1] ?? null;
  }
  return out;
}

/** Validated form values → $set payload. */
export function toUpdate(def: ResourceDef, values: Doc): Doc {
  const set: Doc = {};
  for (const f of def.fields) {
    let v = values[f.key];
    if (f.type === "date") v = v ? new Date(`${v}T00:00:00+05:45`) : null;
    if (f.type === "image" && !v) v = undefined;
    set[f.key] = v;
  }
  if (def.key === "districts") {
    delete set.centerLat;
    delete set.centerLng;
    set.center = values.centerLat != null && values.centerLng != null ? [values.centerLng, values.centerLat] : undefined;
  }
  return set;
}

export const cell = (doc: Doc, key: string) => get(doc, key);
