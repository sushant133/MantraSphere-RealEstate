"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { nextPropertyCode } from "@/lib/counters";
import { connectDB } from "@/lib/db";
import { PROPERTY_TYPES, PURPOSES } from "@/lib/constants";
import { findConflicts, type Conflict } from "@/lib/properties/conflicts";
import { draftSchema, type DraftInput, type SubmitIssue } from "@/lib/properties/listing-schema";
import { applyDraft, docToDraft, EDITABLE_STATUSES, loadOwned, prepareForReview, reviewChecks, submitForReview } from "@/lib/properties/owner";
import { createCheckout, startPayment, type StartResult } from "@/lib/payments/service";
import { PAYMENT_PROVIDERS } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { deletePropertyImage } from "@/lib/storage";
import { AgentProfile, Lead, Plan, Property, User } from "@/models";

/**
 * Owner dashboard actions. Every action re-checks the session and ownership
 * (never trust the client) and validates input with Zod.
 */

const objectId = z.string().regex(/^[a-f0-9]{24}$/);
const loc = z.enum(["en", "ne"]).catch("en");

function revalidatePublic(slug?: string) {
  revalidateTag("properties");
  if (slug) revalidateTag(`property:${slug}`);
}

// ---- Create / save / submit ---------------------------------------------------------

export async function createDraft(input: { purpose: string; type: string; locale: string; planSlug?: string }) {
  const user = await assertUser();
  const parsed = z.object({ purpose: z.enum(PURPOSES), type: z.enum(PROPERTY_TYPES) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  if (!rateLimit(`draft:${user.id}`, 20, 60 * 60_000).ok) return { ok: false as const, error: "rate_limited" };
  await connectDB();
  const owner = await User.findById(user.id).select("name phone").lean();
  const code = await nextPropertyCode();
  const chosenPlan = input.planSlug && /^[a-z0-9-]{2,40}$/.test(input.planSlug) ? await Plan.findOne({ slug: input.planSlug, active: true }).select("_id").lean() : null;
  const doc = await Property.create({
    requestedPlan: chosenPlan?._id,
    code,
    slug: `draft-${code.toLowerCase()}`,
    title: { en: "", ne: "" },
    purpose: parsed.data.purpose,
    type: parsed.data.type,
    priceUnit: parsed.data.purpose === "SALE" ? "TOTAL" : "PER_MONTH",
    status: "DRAFT",
    owner: user.id,
    postedBy: user.role === "AGENT" ? "AGENT" : "OWNER",
    contactName: owner?.name || undefined,
    contactPhone: owner?.phone || undefined,
    whatsapp: owner?.phone || undefined,
  });
  redirect(`/${loc.parse(input.locale)}/dashboard/listings/${doc._id}/edit`);
}

export type SaveResult =
  | { ok: true; savedAt: string; invalid: string[]; conflicts: Conflict[]; title: string; priceOutlier: boolean }
  | { ok: false; error: "invalid" | "not_found" | "not_editable" | "rate_limited" };

export async function saveDraft(id: string, data: DraftInput): Promise<SaveResult> {
  const user = await assertUser();
  if (!objectId.safeParse(id).success) return { ok: false, error: "not_found" };
  if (!rateLimit(`save:${user.id}`, 600, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  const parsed = draftSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const doc = await loadOwned(id, user.id);
  if (!doc) return { ok: false, error: "not_found" };
  if (!(EDITABLE_STATUSES as readonly string[]).includes(doc.status)) return { ok: false, error: "not_editable" };
  const { invalid } = await applyDraft(doc, parsed.data);
  await doc.save();
  const d = docToDraft(doc.toObject());
  const conflicts = [...findConflicts(d.descriptionEn ?? "", { ...d, areaInput: d.areaInput ?? null }), ...findConflicts(d.descriptionNe ?? "", { ...d, areaInput: d.areaInput ?? null })];
  return { ok: true, savedAt: new Date().toISOString(), invalid, conflicts, title: doc.title?.en ?? "", priceOutlier: !!doc.priceNeedsApproval };
}

export async function checkListing(id: string): Promise<{ ok: true; issues: SubmitIssue[]; warnings: string[] } | { ok: false }> {
  const user = await assertUser();
  const doc = await loadOwned(id, user.id);
  if (!doc) return { ok: false };
  const { issues, warnings } = await reviewChecks(doc);
  return { ok: true, issues, warnings };
}

export async function submitListing(id: string, locale: string): Promise<{ ok: false; issues?: SubmitIssue[]; error?: string } | never> {
  const user = await assertUser();
  const doc = await loadOwned(id, user.id);
  if (!doc) return { ok: false, error: "not_found" };
  if (!(EDITABLE_STATUSES as readonly string[]).includes(doc.status)) return { ok: false, error: "not_editable" };
  const l = loc.parse(locale);
  // Company staff list for free; everyone else pays before review.
  if (user.role === "ADMIN" || user.role === "STAFF") {
    const r = await submitForReview(doc, user.id);
    if (!r.ok) return r;
    redirect(`/${l}/dashboard/listings?submitted=${doc.code}`);
  }
  const prep = await prepareForReview(doc);
  if (!prep.ok) return prep;
  if (!doc.requestedPlan) return { ok: false, issues: ["plan"] };
  const c = await createCheckout({ userId: user.id, propertyId: id, planId: String(doc.requestedPlan), purpose: "NEW_LISTING" });
  if (!c.ok) return { ok: false, error: c.error };
  redirect(`/${l}/dashboard/checkout/${c.paymentId}`);
}

/** Renew or upgrade a live/expired listing: plan activates right after payment. */
export async function renewListing(id: string, planId: string, locale: string): Promise<{ ok: false; error: string } | never> {
  const user = await assertUser();
  if (!objectId.safeParse(planId).success) return { ok: false, error: "plan" };
  const c = await createCheckout({ userId: user.id, propertyId: id, planId, purpose: "RENEWAL" });
  if (!c.ok) return { ok: false, error: c.error };
  redirect(`/${loc.parse(locale)}/dashboard/checkout/${c.paymentId}`);
}

export async function payWith(paymentId: string, provider: string, locale: string): Promise<StartResult> {
  const user = await assertUser();
  const p = z.object({ paymentId: objectId, provider: z.enum(PAYMENT_PROVIDERS) }).safeParse({ paymentId, provider });
  if (!p.success) return { kind: "error", error: "invalid" };
  if (!rateLimit(`pay:${user.id}`, 30, 60 * 60_000).ok) return { kind: "error", error: "rate_limited" };
  return startPayment(p.data.paymentId, user.id, p.data.provider, loc.parse(locale));
}

// ---- Listing lifecycle ----------------------------------------------------------------

/** Take a live/pending listing back to draft for editing (it goes offline until re-approved). */
export async function reopenForEdit(id: string, locale: string) {
  const user = await assertUser();
  const doc = await loadOwned(id, user.id);
  if (!doc || !["ACTIVE", "EXPIRED", "PENDING_REVIEW", "REJECTED"].includes(doc.status)) return { ok: false as const };
  const wasPublic = doc.status === "ACTIVE";
  doc.status = "DRAFT";
  await doc.save();
  if (wasPublic) revalidatePublic(doc.slug);
  redirect(`/${loc.parse(locale)}/dashboard/listings/${doc._id}/edit`);
}

export async function markClosed(id: string) {
  const user = await assertUser();
  const doc = await loadOwned(id, user.id);
  if (!doc || doc.status !== "ACTIVE") return { ok: false as const };
  doc.status = doc.purpose === "SALE" ? "SOLD" : "RENTED";
  doc.soldAt = new Date();
  await doc.save();
  revalidatePublic(doc.slug);
  return { ok: true as const, status: doc.status };
}

export async function deleteListing(id: string) {
  const user = await assertUser();
  const doc = await loadOwned(id, user.id);
  if (!doc) return { ok: false as const };
  const wasPublic = ["ACTIVE", "SOLD", "RENTED"].includes(doc.status);
  doc.status = "DELETED";
  doc.deletedAt = new Date();
  await doc.save({ validateBeforeSave: false });
  if (wasPublic) revalidatePublic(doc.slug);
  return { ok: true as const };
}

export async function removeImage(id: string, imageId: string) {
  const user = await assertUser();
  if (!objectId.safeParse(imageId).success) return { ok: false as const };
  const doc = await loadOwned(id, user.id);
  if (!doc || !(EDITABLE_STATUSES as readonly string[]).includes(doc.status)) return { ok: false as const };
  const img = doc.images.find((i) => String(i._id) === imageId);
  if (!img) return { ok: false as const };
  const wasCover = img.isCover;
  doc.images.pull({ _id: imageId });
  doc.images.forEach((i, idx) => {
    i.order = idx;
    if (wasCover) i.isCover = idx === 0;
  });
  await doc.save();
  // Only delete files no other listing references (demo images are shared).
  await deletePropertyImage(id, img.url);
  return { ok: true as const };
}

// ---- Leads ------------------------------------------------------------------------------

export async function updateLeadStatus(leadId: string, status: string) {
  const user = await assertUser();
  const parsed = z.object({ leadId: objectId, status: z.enum(["NEW", "CONTACTED", "CLOSED"]) }).safeParse({ leadId, status });
  if (!parsed.success) return { ok: false as const };
  await connectDB();
  const r = await Lead.updateOne({ _id: parsed.data.leadId, owner: user.id }, { $set: { status: parsed.data.status } });
  return { ok: r.matchedCount === 1 };
}

// ---- Profile -----------------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  locale: z.enum(["en", "ne"]),
  kind: z.enum(["INDIVIDUAL_OWNER", "AGENT", "AGENCY"]),
  agencyName: z.string().trim().max(120),
  whatsapp: z.string().trim().max(20),
  viber: z.string().trim().max(20),
});

export async function updateProfile(input: z.input<typeof profileSchema>) {
  const user = await assertUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const d = parsed.data;
  const { normalizePhone } = await import("@/lib/phone");
  const wa = d.whatsapp ? normalizePhone(d.whatsapp) : null;
  const vb = d.viber ? normalizePhone(d.viber) : null;
  if ((d.whatsapp && !wa) || (d.viber && !vb)) return { ok: false as const, error: "invalid_phone" };
  await connectDB();
  await User.updateOne({ _id: user.id }, { $set: { name: d.name, locale: d.locale } });
  await AgentProfile.updateOne(
    { user: user.id },
    { $set: { kind: d.kind, agencyName: d.kind === "AGENCY" ? d.agencyName : undefined, whatsapp: wa?.e164, viber: vb?.e164 }, $setOnInsert: { user: user.id } },
    { upsert: true },
  );
  return { ok: true as const };
}
