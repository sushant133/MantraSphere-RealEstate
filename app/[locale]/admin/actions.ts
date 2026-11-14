"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { activateListing, notifyListingDecision } from "@/lib/admin/activation";
import { audit, snap } from "@/lib/admin/audit";
import { assertStaff } from "@/lib/admin/auth";
import { MODELS, toUpdate } from "@/lib/admin/registry";
import { getResource, schemaFor } from "@/lib/admin/resources";
import { connectDB } from "@/lib/db";
import { PROPERTY_STATUSES, ROLES, TIERS, TIER_RANK } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { SITE_SETTINGS_SCHEMA } from "@/lib/admin/settings-schema";
import { AgentProfile, Payment, Plan, Property, Report, SiteSetting, SlugRedirect, User } from "@/models";
import { completePayment, failPayment } from "@/lib/payments/service";
import { sendSms } from "@/lib/messaging";
import { propertySlug } from "@/lib/slug";

/**
 * Admin mutations. Each one checks the caller's permission, validates input,
 * writes an audit-log entry and revalidates the affected public caches.
 */

const objectId = z.string().regex(/^[a-f0-9]{24}$/);
export type AdminResult = { ok: true; id?: string } | { ok: false; error: string; fields?: string[] };
const fail = (error: string, fields?: string[]): AdminResult => ({ ok: false, error, fields });

// ---- Moderation --------------------------------------------------------------------------

export async function approveListing(input: { id: string; planId: string }): Promise<AdminResult> {
  const actor = await assertStaff("moderate");
  const p = z.object({ id: objectId, planId: objectId }).safeParse(input);
  if (!p.success) return fail("invalid");
  await connectDB();
  const before = await Property.findById(p.data.id).select("status tier currentPlan expiresAt").lean();
  if (!before) return fail("not_found");
  if (before.status !== "PENDING_REVIEW") return fail("not_pending");
  const paid = await Payment.findOne({ property: p.data.id, plan: p.data.planId, purpose: "NEW_LISTING", status: "COMPLETED" }).sort({ paidAt: -1 }).select("_id").lean();
  const r = await activateListing({ propertyId: p.data.id, planId: p.data.planId, actorId: actor.id, paymentId: paid ? String(paid._id) : null });
  const after = await Property.findById(p.data.id).select("status tier currentPlan expiresAt").lean();
  await audit(actor.id, "property.approve", "property", p.data.id, snap(before), snap(after));
  await notifyListingDecision(r.ownerId, { code: r.code, title: r.title, slug: r.slug, approved: true });
  return { ok: true };
}

export async function rejectListing(input: { id: string; reason: string }): Promise<AdminResult> {
  const actor = await assertStaff("moderate");
  const p = z.object({ id: objectId, reason: z.string().trim().min(5).max(500) }).safeParse(input);
  if (!p.success) return fail("invalid", ["reason"]);
  await connectDB();
  const doc = await Property.findById(p.data.id);
  if (!doc) return fail("not_found");
  if (doc.status !== "PENDING_REVIEW") return fail("not_pending");
  const before = snap({ status: doc.status });
  doc.status = "REJECTED";
  doc.rejectionReason = p.data.reason;
  doc.reviewedAt = new Date();
  doc.reviewedBy = actor.id as never;
  await doc.save();
  await audit(actor.id, "property.reject", "property", p.data.id, before, { status: "REJECTED", reason: p.data.reason });
  await notifyListingDecision(String(doc.owner), { code: doc.code, title: doc.title?.en ?? doc.code, approved: false, reason: p.data.reason });
  return { ok: true };
}

export async function resolveReport(input: { id: string; status: "RESOLVED" | "DISMISSED" }): Promise<AdminResult> {
  const actor = await assertStaff("moderate");
  const p = z.object({ id: objectId, status: z.enum(["RESOLVED", "DISMISSED"]) }).safeParse(input);
  if (!p.success) return fail("invalid");
  await connectDB();
  const r = await Report.findByIdAndUpdate(p.data.id, { $set: { status: p.data.status } });
  if (!r) return fail("not_found");
  await audit(actor.id, `report.${p.data.status.toLowerCase()}`, "report", p.data.id, { status: r.status }, { status: p.data.status });
  return { ok: true };
}

// ---- Payments (bank transfer verification) ------------------------------------------------

export async function verifyBankPayment(input: { id: string; approve: boolean; note: string }): Promise<AdminResult> {
  const actor = await assertStaff("moderate");
  const p = z.object({ id: objectId, approve: z.boolean(), note: z.string().trim().max(300) }).safeParse(input);
  if (!p.success || (!p.data.approve && p.data.note.length < 5)) return fail("invalid", ["note"]);
  await connectDB();
  const pay = await Payment.findById(p.data.id).select("status user invoiceNo amountNpr").lean();
  if (!pay || pay.status !== "PENDING_VERIFICATION") return fail("not_pending");
  if (p.data.approve) {
    await completePayment(p.data.id, { txnId: `BANK-${pay.invoiceNo}`, actorId: actor.id });
  } else {
    await failPayment(p.data.id, p.data.note);
    const u = await User.findById(pay.user).select("phone locale").lean();
    if (u?.phone) {
      await sendSms(u.phone, `MantraSphere: we could not confirm your bank transfer for ${pay.invoiceNo} (Rs ${pay.amountNpr}): ${p.data.note}`).catch(() => {});
    }
  }
  await audit(actor.id, p.data.approve ? "payment.verify" : "payment.reject", "payment", p.data.id, { status: "PENDING_VERIFICATION" }, { status: p.data.approve ? "COMPLETED" : "FAILED", note: p.data.note || undefined });
  return { ok: true };
}

// ---- Listing edit (staff) -------------------------------------------------------------------

const listingEdit = z.object({
  id: objectId,
  titleEn: z.string().trim().min(5).max(140),
  titleNe: z.string().trim().max(140),
  titleLocked: z.boolean(),
  status: z.enum(PROPERTY_STATUSES),
  tier: z.enum(TIERS),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  priceNpr: z.number().int().min(1).max(9e15).nullable(),
  priceOnRequest: z.boolean(),
  negotiable: z.boolean(),
  priceNeedsApproval: z.boolean(),
  descriptionEn: z.string().max(5000),
  descriptionNe: z.string().max(5000),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: z.string().trim().max(20),
});

export async function updateListing(input: z.input<typeof listingEdit>): Promise<AdminResult> {
  const actor = await assertStaff("listings");
  const p = listingEdit.safeParse(input);
  if (!p.success) return fail("invalid", p.error.issues.map((i) => String(i.path[0])));
  const d = p.data;
  const phone = normalizePhone(d.contactPhone);
  if (!phone) return fail("invalid", ["contactPhone"]);
  if (!d.priceOnRequest && !d.priceNpr) return fail("invalid", ["priceNpr"]);
  await connectDB();
  const doc = await Property.findById(d.id);
  if (!doc) return fail("not_found");
  const before = snap(doc);
  const oldSlug = doc.slug;
  const wasPublic = ["ACTIVE", "SOLD", "RENTED"].includes(doc.status);

  doc.set("title", { en: d.titleEn, ne: d.titleNe || d.titleEn });
  doc.titleLocked = d.titleLocked;
  doc.status = d.status;
  if (d.status === "DELETED") doc.deletedAt = doc.deletedAt ?? new Date();
  if ((d.status === "SOLD" || d.status === "RENTED") && !doc.soldAt) doc.soldAt = new Date();
  doc.tier = d.tier;
  doc.tierRank = TIER_RANK[d.tier];
  doc.expiresAt = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59+05:45`) : undefined;
  doc.priceNpr = d.priceOnRequest ? null : d.priceNpr;
  doc.priceOnRequest = d.priceOnRequest;
  doc.negotiable = d.negotiable;
  doc.set("description", { en: d.descriptionEn, ne: d.descriptionNe });
  doc.contactName = d.contactName;
  doc.contactPhone = phone.e164;
  // Staff can confirm an outlier price; otherwise the model recomputes the flag.
  await doc.save();
  if (!d.priceNeedsApproval && doc.priceNeedsApproval) await Property.updateOne({ _id: doc._id }, { $set: { priceNeedsApproval: false } });

  // Changed title → new slug, old one 301s (fix #23).
  if (!oldSlug.startsWith("draft-")) {
    const next = propertySlug(d.titleEn, doc.code);
    if (next !== oldSlug) {
      await Property.updateOne({ _id: doc._id }, { $set: { slug: next } });
      await SlugRedirect.updateOne({ entity: "property", from: oldSlug }, { $set: { to: next } }, { upsert: true });
      await SlugRedirect.updateMany({ entity: "property", to: oldSlug }, { $set: { to: next } });
    }
  }
  await audit(actor.id, "property.update", "property", d.id, before, snap(await Property.findById(d.id).lean()));
  if (wasPublic || ["ACTIVE", "SOLD", "RENTED"].includes(d.status)) {
    revalidateTag("properties");
    revalidateTag(`property:${oldSlug}`);
  }
  return { ok: true };
}

// ---- Users & verification -------------------------------------------------------------------

export async function updateUser(input: { id: string; role: string; disabled: boolean; verified: boolean }): Promise<AdminResult> {
  const actor = await assertStaff("users");
  const p = z.object({ id: objectId, role: z.enum(ROLES), disabled: z.boolean(), verified: z.boolean() }).safeParse(input);
  if (!p.success) return fail("invalid");
  if (p.data.id === actor.id && (p.data.role !== "ADMIN" || p.data.disabled)) return fail("self_lockout");
  await connectDB();
  const before = await User.findById(p.data.id).select("role disabled verified").lean();
  if (!before) return fail("not_found");
  await User.updateOne({ _id: p.data.id }, { $set: { role: p.data.role, disabled: p.data.disabled, verified: p.data.verified } });
  await audit(actor.id, "user.update", "user", p.data.id, snap(before), { role: p.data.role, disabled: p.data.disabled, verified: p.data.verified });
  return { ok: true };
}

export async function reviewVerification(input: { userId: string; approve: boolean; note: string }): Promise<AdminResult> {
  const actor = await assertStaff("verify");
  const p = z.object({ userId: objectId, approve: z.boolean(), note: z.string().trim().max(300) }).safeParse(input);
  if (!p.success || (!p.data.approve && p.data.note.length < 5)) return fail("invalid", ["note"]);
  await connectDB();
  const profile = await AgentProfile.findOne({ user: p.data.userId });
  if (!profile) return fail("not_found");
  const before = { verificationStatus: profile.verificationStatus };
  profile.verificationStatus = p.data.approve ? "APPROVED" : "REJECTED";
  profile.verificationNote = p.data.approve ? undefined : p.data.note;
  profile.reviewedBy = actor.id as never;
  profile.reviewedAt = new Date();
  await profile.save();
  const user = await User.findById(p.data.userId);
  if (user) {
    user.verified = p.data.approve;
    if (p.data.approve && profile.kind !== "INDIVIDUAL_OWNER" && ["USER", "OWNER"].includes(user.role)) user.role = "AGENT";
    await user.save();
  }
  await audit(actor.id, p.data.approve ? "verification.approve" : "verification.reject", "user", p.data.userId, before, {
    verificationStatus: profile.verificationStatus,
    note: p.data.note || undefined,
  });
  revalidateTag("properties"); // verified badge on listings
  return { ok: true };
}

// ---- Site settings --------------------------------------------------------------------------

export async function saveSettings(input: unknown): Promise<AdminResult> {
  const actor = await assertStaff("settings");
  const p = SITE_SETTINGS_SCHEMA.safeParse(input);
  if (!p.success) return fail("invalid", p.error.issues.map((i) => i.path.join(".")));
  const phones = p.data.phones.map((x) => normalizePhone(x)?.e164);
  if (phones.some((x) => !x)) return fail("invalid", ["phones"]);
  const one = (v: string) => (v ? normalizePhone(v)?.e164 : undefined);
  if ((p.data.whatsapp && !one(p.data.whatsapp)) || (p.data.viber && !one(p.data.viber))) return fail("invalid", ["whatsapp", "viber"]);
  await connectDB();
  const before = await SiteSetting.findById("site").lean();
  // Keep each rate's "updated" date unless the rate itself changed.
  const prevRates = new Map(((before?.loanRates ?? []) as { bank?: string; ratePct?: number; updatedAt?: Date }[]).map((r) => [`${r.bank}|${r.ratePct}`, r.updatedAt]));
  const loanRates = p.data.loanRates.map((r) => ({ ...r, updatedAt: prevRates.get(`${r.bank}|${r.ratePct}`) ?? new Date() }));
  const next = { ...p.data, loanRates, phones, whatsapp: one(p.data.whatsapp), viber: one(p.data.viber) };
  await SiteSetting.updateOne({ _id: "site" }, { $set: next }, { upsert: true });
  await audit(actor.id, "settings.update", "settings", "site", snap(before), snap(next));
  revalidateTag("settings");
  return { ok: true };
}

// ---- Generic resources ----------------------------------------------------------------------

export async function saveResource(key: string, id: string | null, values: unknown): Promise<AdminResult> {
  const def = getResource(key);
  if (!def) return fail("invalid");
  const actor = await assertStaff(def.perm);
  if (!id && !def.create) return fail("forbidden");
  if (id && !objectId.safeParse(id).success) return fail("invalid");
  const p = schemaFor(def).safeParse(values);
  if (!p.success) return fail("invalid", [...new Set(p.error.issues.map((i) => String(i.path[0])))]);
  await connectDB();
  const Model = MODELS[key]();
  const set = toUpdate(def, p.data as Record<string, unknown>);
  try {
    if (id) {
      const before = await Model.findById(id).lean();
      if (!before) return fail("not_found");
      await Model.updateOne({ _id: id } as never, { $set: set } as never, { runValidators: true });
      await audit(actor.id, `${key}.update`, key, id, snap(before), snap(set));
      revalidateTag(def.tag);
      return { ok: true, id };
    }
    const created = await Model.create(set as never);
    const newId = String((created as unknown as { _id: unknown })._id);
    await audit(actor.id, `${key}.create`, key, newId, null, snap(set));
    revalidateTag(def.tag);
    return { ok: true, id: newId };
  } catch (e) {
    const msg = (e as { code?: number }).code === 11000 ? "duplicate" : "invalid";
    return fail(msg, msg === "duplicate" ? ["slug"] : undefined);
  }
}

export async function deleteResource(key: string, id: string): Promise<AdminResult> {
  const def = getResource(key);
  if (!def || !def.remove || !objectId.safeParse(id).success) return fail("invalid");
  const actor = await assertStaff(def.perm);
  await connectDB();
  const Model = MODELS[key]();
  const before = await Model.findById(id).lean();
  if (!before) return fail("not_found");
  await Model.deleteOne({ _id: id } as never);
  await audit(actor.id, `${key}.delete`, key, id, snap(before), null);
  revalidateTag(def.tag);
  return { ok: true };
}

export async function planOptions() {
  await assertStaff("moderate");
  await connectDB();
  return (await Plan.find({ active: true }).sort({ sortWeight: 1 }).lean()).map((p) => ({ id: String(p._id), label: `${p.name?.en} — Rs ${p.priceNpr.toLocaleString("en-IN")}` }));
}

