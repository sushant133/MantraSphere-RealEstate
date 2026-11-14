import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { expireListings, sendExpiryReminders } from "@/lib/plan-engine";
import { reconcilePayments } from "@/lib/payments/service";
import { runSearchAlerts } from "@/lib/search-alerts";

export const dynamic = "force-dynamic";

/**
 * Hourly job: expire listings, send 7-day/1-day reminders, reconcile
 * gateway payments, send saved-search alerts. Call with
 * `Authorization: Bearer $CRON_SECRET` (crontab on the VPS: see README).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const ok = secret.length >= 16 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return new NextResponse("Not found", { status: 404 });
  const started = Date.now();
  const expired = await expireListings();
  const reminders = await sendExpiryReminders();
  const payments = await reconcilePayments();
  const alerts = await runSearchAlerts();
  return NextResponse.json({ ...expired, reminders: reminders.sent, payments, alerts, ms: Date.now() - started });
}
