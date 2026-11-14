import "server-only";
import mongoose from "mongoose";
import { connectDB, trusted } from "@/lib/db";
import { Lead, Plan, Property } from "@/models";

/** Read models for the owner dashboard. Every query is scoped to the owner. */

const oid = (s: string) => new mongoose.Types.ObjectId(s);

export async function ownerStats(userId: string) {
  await connectDB();
  const [byStatus, newLeads] = await Promise.all([
    Property.aggregate<{ _id: string; n: number; views: number }>([
      { $match: { owner: oid(userId), status: { $ne: "DELETED" } } },
      { $group: { _id: "$status", n: { $sum: 1 }, views: { $sum: "$views" } } },
    ]),
    Lead.countDocuments({ owner: userId, status: "NEW" }),
  ]);
  const count = (s: string) => byStatus.find((r) => r._id === s)?.n ?? 0;
  return {
    active: count("ACTIVE"),
    pending: count("PENDING_REVIEW"),
    drafts: count("DRAFT") + count("REJECTED"),
    newLeads,
    views: byStatus.reduce((s, r) => s + (r.views ?? 0), 0),
  };
}

export type OwnerListing = {
  id: string;
  code: string;
  slug: string;
  title: { en: string; ne: string };
  status: string;
  purpose: string;
  views: number;
  leads: number;
  cover: string | null;
  expiresAt: string | null;
  updatedAt: string;
  plan: { en: string; ne: string } | null;
  untilSold: boolean;
  rejectionReason: string | null;
};

export async function ownerListings(userId: string, status?: string): Promise<OwnerListing[]> {
  await connectDB();
  const filter: Record<string, unknown> = { owner: userId, status: trusted({ $ne: "DELETED" }) };
  if (status === "DRAFT") filter.status = trusted({ $in: ["DRAFT", "REJECTED"] });
  else if (status === "CLOSED") filter.status = trusted({ $in: ["SOLD", "RENTED"] });
  else if (status && /^[A-Z_]{3,20}$/.test(status)) filter.status = status;
  const docs = await Property.find(filter)
    .select("code slug title status purpose views leadsCount images expiresAt updatedAt currentPlan requestedPlan rejectionReason")
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  const planIds = [...new Set(docs.flatMap((d) => [d.currentPlan, d.requestedPlan]).filter(Boolean).map(String))];
  const plans = new Map((await Plan.find({ _id: trusted({ $in: planIds }) }).select("name durationDays").lean()).map((p) => [String(p._id), p]));
  return docs.map((d) => {
    const plan = plans.get(String(d.currentPlan ?? d.requestedPlan ?? ""));
    const cover = [...(d.images ?? [])].sort((a, b) => Number(b.isCover) - Number(a.isCover))[0];
    return {
      id: String(d._id),
      code: d.code,
      slug: d.slug,
      title: { en: d.title?.en ?? "", ne: d.title?.ne || d.title?.en || "" },
      status: d.status,
      purpose: d.purpose,
      views: d.views ?? 0,
      leads: d.leadsCount ?? 0,
      cover: cover?.url?.replace(/-1600\.webp$/, "-400.webp") ?? null,
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      updatedAt: (d.updatedAt as Date).toISOString(),
      plan: plan?.name ? { en: plan.name.en, ne: plan.name.ne } : null,
      untilSold: !!plan && plan.durationDays == null,
      rejectionReason: d.rejectionReason ?? null,
    };
  });
}

export type OwnerLead = {
  id: string;
  code: string;
  propertySlug: string | null;
  propertyTitle: { en: string; ne: string } | null;
  source: string;
  status: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  createdAt: string;
};

export async function ownerLeads(userId: string, status?: string, limit = 200): Promise<OwnerLead[]> {
  await connectDB();
  const filter: Record<string, unknown> = { owner: userId };
  if (status && ["NEW", "CONTACTED", "CLOSED"].includes(status)) filter.status = status;
  const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  const props = new Map(
    (await Property.find({ _id: trusted({ $in: [...new Set(leads.map((l) => String(l.property)).filter(Boolean))] }) }).select("slug title status").lean()).map((p) => [
      String(p._id),
      p,
    ]),
  );
  return leads.map((l) => {
    const p = l.property ? props.get(String(l.property)) : undefined;
    const isPublic = p && ["ACTIVE", "SOLD", "RENTED"].includes(p.status);
    return {
      id: String(l._id),
      code: l.propertyCode ?? "",
      propertySlug: isPublic ? p!.slug : null,
      propertyTitle: p ? { en: p.title?.en ?? "", ne: p.title?.ne || p.title?.en || "" } : null,
      source: l.source,
      status: l.status,
      name: l.name ?? null,
      phone: l.phone ?? null,
      email: l.email ?? null,
      message: l.message ?? null,
      createdAt: (l.createdAt as Date).toISOString(),
    };
  });
}
