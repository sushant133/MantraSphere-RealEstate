import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Payment, Plan, Property } from "@/models";

/** A payment with its plan and listing, for the owner (or null if not theirs). */
export async function loadOwnPayment(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const pay = await Payment.findOne({ _id: id, user: userId }).lean();
  if (!pay) return null;
  const [plan, prop] = await Promise.all([Plan.findById(pay.plan).lean(), Property.findById(pay.property).select("code title slug status").lean()]);
  return {
    id: String(pay._id),
    invoiceNo: pay.invoiceNo,
    amountNpr: pay.amountNpr,
    status: pay.status as string,
    purpose: pay.purpose as "NEW_LISTING" | "RENEWAL",
    provider: (pay.provider as string | undefined) ?? null,
    planName: { en: plan?.name?.en ?? "", ne: plan?.name?.ne || plan?.name?.en || "" },
    durationDays: plan?.durationDays ?? null,
    listing: prop ? { code: prop.code, title: { en: prop.title?.en ?? "", ne: prop.title?.ne || prop.title?.en || "" }, slug: prop.slug, status: prop.status } : null,
    createdAt: (pay.createdAt as Date).toISOString(),
    paidAt: pay.paidAt ? pay.paidAt.toISOString() : null,
  };
}
