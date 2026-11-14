import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { revalidateTag } from "next/cache";
import { TIER_RANK, type Tier } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { sendEmail, sendSms } from "@/lib/messaging";
import { absoluteUrl } from "@/lib/seo";
import { Plan, Property, Subscription, User } from "@/models";

/**
 * Put a listing live on a plan: status ACTIVE, tier/rank, expiry, and an
 * ACTIVE subscription — all in one transaction. Used by moderation (now) and
 * by payment verification (Phase 5).
 */
export async function activateListing(opts: {
  propertyId: string;
  planId: string;
  actorId: string;
  paymentId?: string | null;
  session?: ClientSession;
}): Promise<{ slug: string; ownerId: string; code: string; title: string }> {
  await connectDB();
  const run = async (session: ClientSession) => {
    const plan = await Plan.findById(opts.planId).session(session);
    if (!plan) throw new Error("PLAN_NOT_FOUND");
    const p = await Property.findById(opts.propertyId).session(session);
    if (!p) throw new Error("PROPERTY_NOT_FOUND");
    const now = new Date();
    const endsAt = plan.durationDays ? new Date(now.getTime() + plan.durationDays * 86_400_000) : null;

    // Close any previous active subscription for this listing.
    await Subscription.updateMany({ property: p._id, status: "ACTIVE" }, { $set: { status: "CANCELLED" } }, { session });
    await Subscription.create(
      [{ property: p._id, plan: plan._id, user: p.owner, payment: opts.paymentId ?? undefined, status: "ACTIVE", startsAt: now, endsAt }],
      { session },
    );

    p.status = "ACTIVE";
    p.tier = plan.tier as Tier;
    p.tierRank = TIER_RANK[plan.tier as Tier];
    p.currentPlan = plan._id;
    p.requestedPlan = undefined;
    p.expiresAt = endsAt ?? undefined;
    p.featuredUntil = endsAt ?? undefined;
    p.publishedAt = p.publishedAt ?? now;
    p.reviewedAt = now;
    p.reviewedBy = new mongoose.Types.ObjectId(opts.actorId);
    p.rejectionReason = undefined;
    await p.save({ session });
    return { slug: p.slug, ownerId: String(p.owner), code: p.code, title: p.title?.en ?? p.code };
  };

  let result: Awaited<ReturnType<typeof run>> | undefined;
  if (opts.session) result = await run(opts.session);
  else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        result = await run(session);
      });
    } finally {
      await session.endSession();
    }
  }
  revalidateTag("properties");
  revalidateTag(`property:${result!.slug}`);
  return result!;
}

/** Tell the owner their listing was approved or needs changes. Never throws. */
export async function notifyListingDecision(ownerId: string, info: { code: string; title: string; slug?: string; approved: boolean; reason?: string }) {
  try {
    await connectDB();
    const owner = await User.findById(ownerId).select("email emailVerified phone locale").lean();
    if (!owner) return;
    const ne = owner.locale === "ne";
    const loc = ne ? "ne" : "en";
    const link = info.approved && info.slug ? absoluteUrl(loc, `/property/${info.slug}`) : absoluteUrl(loc, "/dashboard/listings");
    const text = info.approved
      ? ne
        ? `मन्त्रास्फियर: तपाईंको सूची ${info.code} अब सक्रिय छ। ${link}`
        : `MantraSphere: your listing ${info.code} is now live. ${link}`
      : ne
        ? `मन्त्रास्फियर: ${info.code} मा सुधार चाहियो: ${info.reason}. ${link}`
        : `MantraSphere: ${info.code} needs changes: ${info.reason}. ${link}`;
    const jobs: Promise<unknown>[] = [];
    if (owner.phone) jobs.push(sendSms(owner.phone, text));
    if (owner.email && owner.emailVerified) {
      jobs.push(sendEmail({ to: owner.email, subject: info.approved ? `${info.code} is live` : `${info.code} needs changes`, text: `${info.title}\n\n${text}` }));
    }
    const res = await Promise.allSettled(jobs);
    res.forEach((r) => r.status === "rejected" && console.error("[notify] decision", (r.reason as Error).message));
  } catch (e) {
    console.error("[notify] decision", (e as Error).message);
  }
}
