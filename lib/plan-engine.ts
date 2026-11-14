import "server-only";
import { revalidateTag } from "next/cache";
import { connectDB, trusted } from "./db";
import { sendEmail, sendSms } from "./messaging";
import { formatDateLike } from "./plan-engine-format";
import { absoluteUrl } from "./seo";
import { Property, Subscription, User } from "@/models";

/**
 * Hourly plan engine (called by /api/cron/expire-listings):
 *  1. expire ACTIVE listings whose plan ended,
 *  2. remind owners 7 days and 1 day before expiry (once each).
 */
export async function expireListings(now = new Date()): Promise<{ expired: number }> {
  await connectDB();
  const due = await Property.find({ status: "ACTIVE", expiresAt: trusted({ $lte: now }) })
    .select("_id slug owner code title")
    .limit(1000)
    .lean();
  if (!due.length) return { expired: 0 };
  const ids = due.map((d) => d._id);
  await Property.updateMany({ _id: trusted({ $in: ids }), status: "ACTIVE" }, { $set: { status: "EXPIRED", tier: "NORMAL", tierRank: 0 } });
  await Subscription.updateMany({ property: trusted({ $in: ids }), status: "ACTIVE" }, { $set: { status: "EXPIRED" } });
  revalidateTag("properties");
  for (const d of due) revalidateTag(`property:${d.slug}`);
  for (const d of due) await notify(String(d.owner), d.code, d.title?.en ?? d.code, "expired", now);
  return { expired: due.length };
}

export async function sendExpiryReminders(now = new Date()): Promise<{ sent: number }> {
  await connectDB();
  let sent = 0;
  for (const [tag, days] of [["7d", 7], ["1d", 1]] as const) {
    const subs = await Subscription.find({
      status: "ACTIVE",
      endsAt: trusted({ $gt: now, $lte: new Date(now.getTime() + days * 86_400_000) }),
      remindersSent: trusted({ $ne: tag }),
    })
      .limit(500)
      .lean();
    for (const s of subs) {
      const p = await Property.findById(s.property).select("code title status owner").lean();
      // Mark first so a messaging failure cannot cause repeated reminders.
      await Subscription.updateOne({ _id: s._id }, { $addToSet: { remindersSent: tag } });
      if (!p || p.status !== "ACTIVE") continue;
      await notify(String(p.owner), p.code, p.title?.en ?? p.code, tag, s.endsAt as Date);
      sent++;
    }
  }
  return { sent };
}

async function notify(ownerId: string, code: string, title: string, kind: "7d" | "1d" | "expired", date: Date) {
  try {
    const u = await User.findById(ownerId).select("email emailVerified phone locale").lean();
    if (!u) return;
    const ne = u.locale === "ne";
    const link = absoluteUrl(ne ? "ne" : "en", "/dashboard/listings");
    const when = formatDateLike(date, ne);
    const text =
      kind === "expired"
        ? ne
          ? `मन्त्रास्फियर: ${code} को योजना सकियो र सूची लुकाइएको छ। नवीकरण गर्नुहोस्: ${link}`
          : `MantraSphere: the plan for ${code} has ended and the listing is now hidden. Renew it here: ${link}`
        : ne
          ? `मन्त्रास्फियर: ${code} को योजना ${when} मा सकिँदैछ। नवीकरण गर्नुहोस्: ${link}`
          : `MantraSphere: the plan for ${code} ends on ${when}. Renew to stay visible: ${link}`;
    const jobs: Promise<unknown>[] = [];
    if (u.phone) jobs.push(sendSms(u.phone, text));
    if (u.email && u.emailVerified) jobs.push(sendEmail({ to: u.email, subject: kind === "expired" ? `${code} has expired` : `${code} expires soon`, text: `${title}\n\n${text}` }));
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("[plan-engine] notify", (e as Error).message);
  }
}
