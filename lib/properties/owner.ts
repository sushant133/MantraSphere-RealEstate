import "server-only";
import mongoose, { type HydratedDocument } from "mongoose";
import { connectDB, trusted } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { buildSearchKeywords } from "@/lib/search-keywords";
import { propertySlug } from "@/lib/slug";
import { generateTitle, typeLabel } from "@/lib/titles";
import { formatAreaInput, toSqFt, type AreaInput } from "@/lib/units";
import { Amenity, District, Municipality, Plan, Property, Province, SlugRedirect, User, type PropertyDoc } from "@/models";
import { findConflicts } from "./conflicts";
import { allowedPriceUnits, isHttpsUrl, isYoutubeUrl, pickTypeFields, submitIssues, type DraftInput, type SubmitIssue } from "./listing-schema";

/** Owner-side listing logic shared by the dashboard pages and server actions. */

type Doc = HydratedDocument<PropertyDoc>;
const { ObjectId } = mongoose.Types;
export const EDITABLE_STATUSES = ["DRAFT", "REJECTED"] as const;

export async function loadOwned(id: string, userId: string): Promise<Doc | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return Property.findOne({ _id: id, owner: userId, status: trusted({ $ne: "DELETED" }) });
}

/** Database document → wizard state. */
export function docToDraft(d: PropertyDoc): DraftInput & { imagesFull: { id: string; url: string; width: number; height: number; blurDataURL: string; alt: string; isCover: boolean }[] } {
  const images = [...(d.images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    purpose: d.purpose,
    type: d.type,
    districtId: d.district ? String(d.district) : null,
    municipalityId: d.municipality ? String(d.municipality) : null,
    ward: d.ward ?? null,
    address: d.address ?? "",
    lat: d.location?.coordinates?.[1] ?? null,
    lng: d.location?.coordinates?.[0] ?? null,
    areaInput: (d.areaInput?.system ? { system: d.areaInput.system, values: d.areaInput.values } : null) as AreaInput | null,
    builtUpAreaSqFt: d.builtUpAreaSqFt ?? null,
    priceOnRequest: !!d.priceOnRequest,
    priceNpr: d.priceNpr ?? null,
    priceUnit: d.priceUnit ?? "TOTAL",
    negotiable: !!d.negotiable,
    facing: d.facing ?? null,
    roadWidthFt: d.roadWidthFt ?? null,
    roadType: d.roadType ?? null,
    mainRoadDistanceM: d.mainRoadDistanceM ?? null,
    floors: d.floors ?? null,
    bedrooms: d.bedrooms ?? null,
    bathrooms: d.bathrooms ?? null,
    kitchens: d.kitchens ?? null,
    livingRooms: d.livingRooms ?? null,
    parking: d.parking ?? null,
    furnishing: d.furnishing ?? null,
    builtYear: d.builtYear ?? null,
    readyToMove: d.readyToMove ?? null,
    ownershipType: d.ownershipType ?? null,
    amenities: d.amenities ?? [],
    nearby: (d.nearby ?? []).map((n) => ({ kind: n.kind, name: n.name, distanceM: n.distanceM ?? null })),
    youtubeUrl: d.videos?.find((v) => v.kind === "YOUTUBE")?.url ?? "",
    tourUrl: d.videos?.find((v) => v.kind === "TOUR_360")?.url ?? "",
    descriptionEn: d.description?.en ?? "",
    descriptionNe: d.description?.ne ?? "",
    images: images.map((i) => ({ id: String(i._id), alt: i.alt, isCover: !!i.isCover })),
    imagesFull: images.map((i) => ({ id: String(i._id), url: i.url, width: i.width, height: i.height, blurDataURL: i.blurDataURL ?? "", alt: i.alt, isCover: !!i.isCover })),
    contactName: d.contactName ?? "",
    contactPhone: d.contactPhone ?? "",
    whatsapp: d.whatsapp ?? "",
    viber: d.viber ?? "",
    planSlug: null,
  };
}

const unset = (doc: Doc, path: string) => doc.set(path, undefined);

/**
 * Apply (partial) wizard data to a document. Values that fail deeper checks
 * (phone numbers, URLs, municipality outside district) are not saved and are
 * reported back so the wizard can show them.
 */
export async function applyDraft(doc: Doc, raw: DraftInput): Promise<{ invalid: string[] }> {
  const invalid: string[] = [];
  const d = { ...raw, ...pickTypeFields(raw.type, raw) } as DraftInput;
  const has = (k: keyof DraftInput) => Object.prototype.hasOwnProperty.call(raw, k);

  if (doc.status === "DRAFT") {
    doc.purpose = d.purpose;
    doc.type = d.type;
  }

  if (has("districtId")) {
    if (!d.districtId) {
      for (const p of ["district", "province", "municipality", "locationNames"]) unset(doc, p);
    } else {
      const district = await District.findById(d.districtId).lean();
      if (!district) invalid.push("districtId");
      else {
        const province = await Province.findById(district.province).lean();
        doc.district = district._id;
        doc.province = district.province;
        doc.set("locationNames.district", { en: district.name.en, ne: district.name.ne, slug: district.slug });
        if (province) doc.set("locationNames.province", { en: province.name.en, ne: province.name.ne, slug: province.slug });
        if (has("municipalityId")) {
          const m = d.municipalityId ? await Municipality.findOne({ _id: d.municipalityId, district: district._id }).lean() : null;
          if (d.municipalityId && !m) invalid.push("municipalityId");
          if (m) {
            doc.municipality = m._id;
            doc.set("locationNames.municipality", { en: m.name.en, ne: m.name.ne, slug: m.slug });
            if (has("ward")) {
              if (d.ward && m.wards && d.ward > m.wards) invalid.push("ward");
              else doc.ward = d.ward ?? undefined;
            }
          } else {
            unset(doc, "municipality");
            unset(doc, "locationNames.municipality");
          }
        }
      }
    }
  }
  if (has("address")) doc.address = d.address ?? "";
  if (has("lat") || has("lng")) {
    if (d.lat != null && d.lng != null) doc.set("location", { type: "Point", coordinates: [d.lng, d.lat] });
    else unset(doc, "location");
  }

  if (has("areaInput")) {
    if (d.areaInput) {
      doc.set("areaInput", d.areaInput);
      doc.areaSqFt = Math.round(toSqFt(d.areaInput) * 100) / 100;
    } else {
      unset(doc, "areaInput");
      unset(doc, "areaSqFt");
    }
  }
  if (has("builtUpAreaSqFt")) doc.builtUpAreaSqFt = d.type === "LAND" ? undefined : (d.builtUpAreaSqFt ?? undefined);

  if (has("priceOnRequest")) doc.priceOnRequest = !!d.priceOnRequest;
  if (has("priceNpr")) doc.priceNpr = d.priceNpr ?? null;
  if (has("negotiable")) doc.negotiable = !!d.negotiable;
  if (has("priceUnit") || has("purpose")) {
    const terai = (await District.findById(doc.district).select("region").lean())?.region === "TERAI";
    const allowed = allowedPriceUnits(d.purpose, d.type, terai);
    doc.priceUnit = d.priceUnit && allowed.includes(d.priceUnit) ? d.priceUnit : allowed[0];
  }

  // Type-specific details: unset everything that does not apply.
  const typed = ["facing", "roadWidthFt", "roadType", "mainRoadDistanceM", "floors", "bedrooms", "bathrooms", "kitchens", "livingRooms", "parking", "furnishing", "builtYear", "readyToMove", "ownershipType"] as const;
  const applicable = pickTypeFields(d.type, Object.fromEntries(typed.map((k) => [k, true])));
  for (const k of typed) {
    if (!(k in applicable)) unset(doc, k);
    else if (has(k)) doc.set(k, (d as Record<string, unknown>)[k] ?? undefined);
  }

  if (has("amenities")) {
    const known = new Set((await Amenity.find().select("slug").lean()).map((a) => a.slug));
    doc.amenities = (d.amenities ?? []).filter((a) => known.has(a));
  }
  if (has("nearby")) doc.set("nearby", d.nearby ?? []);
  if (has("youtubeUrl") || has("tourUrl")) {
    const videos: { kind: "YOUTUBE" | "TOUR_360"; url: string }[] = [];
    if (d.youtubeUrl) {
      if (isYoutubeUrl(d.youtubeUrl)) videos.push({ kind: "YOUTUBE", url: d.youtubeUrl });
      else invalid.push("youtubeUrl");
    }
    if (d.tourUrl) {
      if (isHttpsUrl(d.tourUrl)) videos.push({ kind: "TOUR_360", url: d.tourUrl });
      else invalid.push("tourUrl");
    }
    doc.set("videos", videos);
  }
  if (has("descriptionEn")) doc.set("description.en", d.descriptionEn ?? "");
  if (has("descriptionNe")) doc.set("description.ne", d.descriptionNe ?? "");

  if (has("images") && d.images) {
    const byId = new Map(doc.images.map((i) => [String(i._id), i]));
    const ordered = d.images.filter((i) => byId.has(i.id));
    const rest = doc.images.filter((i) => !ordered.some((o) => o.id === String(i._id)));
    const coverId = ordered.find((i) => i.isCover)?.id ?? ordered[0]?.id;
    const next = [
      ...ordered.map((o, idx) => Object.assign(byId.get(o.id)!.toObject(), { alt: o.alt.trim() || byId.get(o.id)!.alt, order: idx, isCover: o.id === coverId })),
      ...rest.map((i, idx) => Object.assign(i.toObject(), { order: ordered.length + idx, isCover: false })),
    ];
    doc.set("images", next);
  }

  if (has("contactName")) doc.contactName = d.contactName || undefined;
  for (const k of ["contactPhone", "whatsapp", "viber"] as const) {
    if (!has(k)) continue;
    const v = d[k];
    if (!v) {
      if (k !== "contactPhone") unset(doc, k);
      continue;
    }
    const n = normalizePhone(v);
    if (n) doc.set(k, n.e164);
    else invalid.push(k);
  }
  if (has("planSlug")) {
    const plan = d.planSlug ? await Plan.findOne({ slug: d.planSlug, active: true }).select("_id").lean() : null;
    doc.requestedPlan = plan?._id;
  }

  await refreshTitle(doc);
  return { invalid };
}

/** Title is generated from structured data (fix #23) unless staff locked it. */
export async function refreshTitle(doc: Doc) {
  if (doc.titleLocked || !doc.locationNames?.district?.en) return;
  const ln = doc.locationNames;
  const district = { en: ln.district!.en!, ne: ln.district!.ne ?? ln.district!.en! };
  const place = ln.municipality?.en ? { en: ln.municipality.en, ne: ln.municipality.ne ?? ln.municipality.en } : null;
  const area = doc.type === "LAND" && doc.areaInput?.system ? (doc.areaInput as AreaInput) : null;
  const common = { purpose: doc.purpose, type: doc.type, bedrooms: doc.bedrooms, place, district };
  doc.set("title", {
    en: generateTitle({ ...common, area: area ? formatAreaInput(area, "en") : null }, "en"),
    ne: generateTitle({ ...common, area: area ? formatAreaInput(area, "ne") : null }, "ne"),
  });
}

export type ReviewCheck = { issues: SubmitIssue[]; warnings: string[] };

/** Everything the review step and submit need: blocking issues + admin warnings. */
export async function reviewChecks(doc: Doc, planSlug?: string | null): Promise<ReviewCheck & { planSlug: string | null; maxPhotos: number }> {
  const draft = docToDraft(doc.toObject());
  const plan = doc.requestedPlan ? await Plan.findById(doc.requestedPlan).lean() : planSlug ? await Plan.findOne({ slug: planSlug }).lean() : null;
  const district = doc.district ? await District.findById(doc.district).select("region").lean() : null;
  const maxPhotos = plan?.maxPhotos ?? 30;
  const issues = submitIssues({ ...draft, planSlug: plan?.slug ?? null }, { terai: district?.region === "TERAI", maxPhotos, imageCount: draft.images?.length ?? 0 });

  const warnings: string[] = [];
  if (doc.priceNeedsApproval) warnings.push("PRICE_OUTLIER");
  if (!doc.images.length) warnings.push("NO_PHOTOS");
  const conflicts = [
    ...findConflicts(draft.descriptionEn ?? "", { ...draft, areaInput: draft.areaInput ?? null }),
    ...findConflicts(draft.descriptionNe ?? "", { ...draft, areaInput: draft.areaInput ?? null }),
  ];
  if (conflicts.length) warnings.push(`DESCRIPTION_CONFLICT:${[...new Set(conflicts.map((c) => c.field))].join(",")}`);
  // Possible duplicate: same contact phone, same district, area within ±3% (fix #18).
  if (doc.contactPhone && doc.district && doc.areaSqFt) {
    const dup = await Property.findOne({
      _id: trusted({ $ne: doc._id }),
      contactPhone: doc.contactPhone,
      district: doc.district,
      areaSqFt: trusted({ $gte: doc.areaSqFt * 0.97, $lte: doc.areaSqFt * 1.03 }),
      status: trusted({ $in: ["PENDING_REVIEW", "ACTIVE"] }),
    })
      .select("code")
      .lean();
    if (dup) warnings.push(`POSSIBLE_DUPLICATE:${dup.code}`);
  }
  return { issues, warnings, planSlug: plan?.slug ?? null, maxPhotos };
}

/**
 * Everything a listing needs before review (title, slug + 301 from the old
 * one, search keywords, admin warnings) — without changing its status. Runs
 * before checkout so the paid-for listing is already complete.
 */
export async function prepareForReview(doc: Doc): Promise<{ ok: true } | { ok: false; issues: SubmitIssue[] }> {
  const check = await reviewChecks(doc);
  if (check.issues.length) return { ok: false, issues: check.issues };

  await refreshTitle(doc);
  const newSlug = propertySlug(doc.title?.en ?? doc.code, doc.code);
  if (doc.slug !== newSlug) {
    if (!doc.slug.startsWith("draft-")) {
      await SlugRedirect.updateOne({ entity: "property", from: doc.slug }, { $set: { to: newSlug } }, { upsert: true });
    }
    await SlugRedirect.updateMany({ entity: "property", to: doc.slug }, { $set: { to: newSlug } });
    doc.slug = newSlug;
  }
  const ln = doc.locationNames;
  doc.searchKeywords = buildSearchKeywords([
    doc.address,
    ln?.municipality?.en,
    ln?.municipality?.ne,
    ln?.district?.en,
    ln?.district?.ne,
    ln?.province?.en,
    typeLabel(doc.type, "en"),
    typeLabel(doc.type, "ne"),
    doc.code,
  ]);
  doc.validationWarnings = check.warnings;
  await doc.save();
  return { ok: true };
}

/** DRAFT/REJECTED → PENDING_REVIEW without payment (staff and imports). */
export async function submitForReview(doc: Doc, userId: string): Promise<{ ok: true } | { ok: false; issues: SubmitIssue[] }> {
  const prep = await prepareForReview(doc);
  if (!prep.ok) return prep;
  doc.status = "PENDING_REVIEW";
  doc.submittedAt = new Date();
  doc.rejectionReason = undefined;
  await doc.save();
  // First listing turns a plain user into an owner.
  await User.updateOne({ _id: userId, role: "USER" }, { $set: { role: "OWNER" } });
  return { ok: true };
}

export const isObjectId = (s: string) => ObjectId.isValid(s);
