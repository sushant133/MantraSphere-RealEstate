import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { randomBytes } from "node:crypto";
import { activateListing } from "@/lib/admin/activation";
import { nextSequence } from "@/lib/counters";
import { connectDB, trusted } from "@/lib/db";
import { esc, sendEmail, sendSms } from "@/lib/messaging";
import { absoluteUrl, SITE_URL } from "@/lib/seo";
import type { PaymentProvider } from "@/lib/constants";
import { Payment, Plan, Property, User } from "@/models";
import { esewaConfig, esewaForm, esewaStatus } from "./esewa";
import { khaltiConfig, khaltiInitiate, khaltiLookup } from "./khalti";
import { mockEnabled, mockReturnUrl } from "./mock";

/**
 * Checkout and payment completion. Completion is idempotent (a conditional
 * status update) and transactional: marking the payment COMPLETED and
 * moving the listing to review / activating the plan happen together.
 */

export const enabledProviders = (): PaymentProvider[] => [
  ...(esewaConfig().enabled ? (["ESEWA"] as const) : []),
  ...(khaltiConfig().enabled ? (["KHALTI"] as const) : []),
  "BANK_TRANSFER",
  ...(mockEnabled() ? (["MOCK"] as const) : []),
];

const formatInvoice = (n: number) => `INV-${String(n).padStart(6, "0")}`;

export type CheckoutError = "not_found" | "not_allowed" | "plan" | "incomplete";

/** Create (or reuse) the open invoice for a listing + plan. */
export async function createCheckout(opts: {
  userId: string;
  propertyId: string;
  planId: string;
  purpose: "NEW_LISTING" | "RENEWAL";
}): Promise<{ ok: true; paymentId: string } | { ok: false; error: CheckoutError }> {
  await connectDB();
  const [prop, plan] = await Promise.all([
    Property.findOne({ _id: opts.propertyId, owner: opts.userId }).select("status").lean(),
    Plan.findOne({ _id: opts.planId, active: true }).lean(),
  ]);
  if (!prop) return { ok: false, error: "not_found" };
  if (!plan) return { ok: false, error: "plan" };
  const allowed = opts.purpose === "NEW_LISTING" ? ["DRAFT", "REJECTED"] : ["ACTIVE", "EXPIRED"];
  if (!allowed.includes(prop.status)) return { ok: false, error: "not_allowed" };

  const open = await Payment.findOne({
    property: opts.propertyId,
    plan: opts.planId,
    purpose: opts.purpose,
    status: trusted({ $in: ["INITIATED", "PENDING_VERIFICATION"] }),
  }).lean();
  if (open) return { ok: true, paymentId: String(open._id) };

  const p = await Payment.create({
    invoiceNo: formatInvoice(await nextSequence("invoice")),
    user: opts.userId,
    property: opts.propertyId,
    plan: plan._id,
    amountNpr: plan.priceNpr,
    purpose: opts.purpose,
    status: "INITIATED",
  });
  return { ok: true, paymentId: String(p._id) };
}

export type StartResult =
  | { kind: "form"; action: string; fields: Record<string, string> }
  | { kind: "redirect"; url: string }
  | { kind: "error"; error: string };

/** Begin a gateway attempt. Each attempt gets a fresh provider reference. */
export async function startPayment(paymentId: string, userId: string, provider: PaymentProvider, locale: "en" | "ne"): Promise<StartResult> {
  await connectDB();
  let pay = await Payment.findOne({ _id: paymentId, user: userId, status: "INITIATED" });
  if (!pay) return { kind: "error", error: "not_found" };
  // Never overwrite an earlier gateway attempt that may have succeeded.
  if ((pay.provider === "ESEWA" || pay.provider === "KHALTI") && pay.providerRef) {
    if ((await verifyGatewayPayment(paymentId)) === "completed") return { kind: "error", error: "already_paid" };
    pay = await Payment.findOne({ _id: paymentId, user: userId, status: "INITIATED" });
    if (!pay) return { kind: "error", error: "not_found" };
  }
  if (!enabledProviders().includes(provider) || provider === "BANK_TRANSFER") return { kind: "error", error: "provider" };
  const attempt = `${pay.invoiceNo}-${randomBytes(4).toString("hex")}`;
  const back = (r: string) => `${SITE_URL}/api/payments/${r}`;

  if (provider === "ESEWA") {
    pay.provider = "ESEWA";
    pay.providerRef = attempt;
    await pay.save();
    const f = esewaForm({ uuid: attempt, amountNpr: pay.amountNpr, successUrl: back(`esewa/return?pid=${pay._id}`), failureUrl: back(`esewa/return?pid=${pay._id}&failed=1`) });
    return { kind: "form", ...f };
  }
  if (provider === "KHALTI") {
    const user = await User.findById(userId).select("name email phone").lean();
    try {
      const k = await khaltiInitiate({
        orderId: attempt,
        orderName: `MantraSphere listing plan ${pay.invoiceNo}`,
        amountNpr: pay.amountNpr,
        returnUrl: back(`khalti/return?pid=${pay._id}`),
        websiteUrl: SITE_URL,
        customer: { name: user?.name ?? undefined, email: user?.email ?? undefined, phone: user?.phone?.replace(/^\+977/, "") ?? undefined },
      });
      pay.provider = "KHALTI";
      pay.providerRef = k.pidx;
      await pay.save();
      return { kind: "redirect", url: k.paymentUrl };
    } catch (e) {
      console.error("[khalti]", (e as Error).message);
      return { kind: "error", error: "gateway" };
    }
  }
  // MOCK
  pay.provider = "MOCK";
  pay.providerRef = attempt;
  await pay.save();
  return { kind: "redirect", url: `/${locale}/dashboard/checkout/${pay._id}/mock` };
}

export const mockLinks = (pid: string) => ({ success: mockReturnUrl("", pid, "success"), failure: mockReturnUrl("", pid, "failure") });

/** Verify with the provider (server-to-server) and complete. */
export async function verifyGatewayPayment(paymentId: string): Promise<"completed" | "failed" | "pending"> {
  await connectDB();
  const pay = await Payment.findById(paymentId);
  if (!pay) return "failed";
  if (pay.status === "COMPLETED") return "completed";
  if (pay.status !== "INITIATED" || !pay.providerRef) return "failed";
  let ok = false;
  let txnId: string | undefined;
  let raw: unknown;
  let terminal = false;
  if (pay.provider === "ESEWA") {
    const r = await esewaStatus(pay.providerRef, pay.amountNpr);
    ok = r.ok;
    txnId = r.refId;
    raw = r.raw;
    terminal = ["CANCELED", "NOT_FOUND", "FULL_REFUND", "PARTIAL_REFUND", "AMBIGUOUS"].includes(r.status);
  } else if (pay.provider === "KHALTI") {
    const r = await khaltiLookup(pay.providerRef, pay.amountNpr);
    ok = r.ok;
    txnId = r.txnId;
    raw = r.raw;
    terminal = ["Expired", "User canceled", "Refunded", "Partially Refunded"].includes(r.status);
  }
  if (ok) {
    await completePayment(paymentId, { txnId, raw });
    return "completed";
  }
  if (terminal) await resetAttempt(paymentId);
  return terminal ? "failed" : "pending";
}

/**
 * The single place a payment becomes COMPLETED. Idempotent: if another
 * request already completed it, this is a no-op.
 */
export async function completePayment(paymentId: string, opts: { txnId?: string; raw?: unknown; actorId?: string } = {}): Promise<boolean> {
  await connectDB();
  const session = await mongoose.startSession();
  let did = false;
  let info: { purpose: string; userId: string; code: string; slug: string; invoiceNo: string; amount: number; planName: string } | null = null;
  try {
    await session.withTransaction(async () => {
      const pay = await Payment.findOneAndUpdate(
        { _id: paymentId, status: trusted({ $in: ["INITIATED", "PENDING_VERIFICATION"] }) },
        {
          $set: {
            status: "COMPLETED",
            paidAt: new Date(),
            providerTxnId: opts.txnId,
            rawVerification: opts.raw,
            ...(opts.actorId ? { verifiedBy: opts.actorId, verifiedAt: new Date() } : {}),
          },
        },
        { new: true, session },
      );
      if (!pay) return; // already processed
      const plan = await Plan.findById(pay.plan).session(session).lean();
      await applyPaidPlan(pay.purpose, String(pay.property), String(pay.plan), String(pay.user), String(pay._id), session);
      const prop = await Property.findById(pay.property).select("code slug").session(session).lean();
      did = true;
      info = { purpose: pay.purpose, userId: String(pay.user), code: prop?.code ?? "", slug: prop?.slug ?? "", invoiceNo: pay.invoiceNo, amount: pay.amountNpr, planName: plan?.name?.en ?? "" };
    });
  } finally {
    await session.endSession();
  }
  if (did && info) await notifyPaid(info);
  return did;
}

async function applyPaidPlan(purpose: string, propertyId: string, planId: string, userId: string, paymentId: string, session: ClientSession) {
  if (purpose === "RENEWAL") {
    await activateListing({ propertyId, planId, actorId: userId, paymentId, session });
    return;
  }
  await Property.updateOne(
    { _id: propertyId, status: trusted({ $in: ["DRAFT", "REJECTED"] }) },
    { $set: { status: "PENDING_REVIEW", submittedAt: new Date(), requestedPlan: planId }, $unset: { rejectionReason: 1 } },
    { session },
  );
  await User.updateOne({ _id: userId, role: "USER" }, { $set: { role: "OWNER" } }, { session });
}

/** A gateway attempt failed: clear it so the same invoice can be paid again. */
export async function resetAttempt(paymentId: string) {
  await connectDB();
  await Payment.updateOne({ _id: paymentId, status: "INITIATED" }, { $unset: { provider: 1, providerRef: 1 } });
}

export async function failPayment(paymentId: string, reason: string) {
  await connectDB();
  await Payment.updateOne({ _id: paymentId, status: trusted({ $in: ["INITIATED", "PENDING_VERIFICATION"] }) }, { $set: { status: "FAILED", failureReason: reason.slice(0, 300) } });
}

/** Bank transfer: owner uploads a slip; staff verify it in the admin panel. */
export async function submitBankTransfer(paymentId: string, userId: string, slipKey: string, reference: string) {
  await connectDB();
  const r = await Payment.updateOne(
    { _id: paymentId, user: userId, status: "INITIATED" },
    { $set: { provider: "BANK_TRANSFER", status: "PENDING_VERIFICATION", bankSlipUrl: slipKey, bankReference: reference.slice(0, 80) }, $unset: { providerRef: 1 } },
  );
  return r.modifiedCount === 1;
}

/** Re-check gateway payments whose browser never came back (cron). */
export async function reconcilePayments(): Promise<{ checked: number; completed: number; failed: number }> {
  await connectDB();
  const now = Date.now();
  // Invoices nobody paid within 7 days are closed.
  await Payment.updateMany(
    { status: "INITIATED", createdAt: trusted({ $lte: new Date(now - 7 * 86_400_000) }) },
    { $set: { status: "FAILED", failureReason: "Not paid within 7 days" } },
  );
  const stale = await Payment.find({
    status: "INITIATED",
    provider: trusted({ $in: ["ESEWA", "KHALTI"] }),
    providerRef: trusted({ $exists: true }),
    updatedAt: trusted({ $lte: new Date(now - 10 * 60_000), $gte: new Date(now - 7 * 86_400_000) }),
  })
    .select("_id updatedAt")
    .limit(200)
    .lean();
  let completed = 0;
  let failed = 0;
  for (const p of stale) {
    try {
      const r = await verifyGatewayPayment(String(p._id));
      if (r === "completed") completed++;
      else if (r === "pending" && now - (p.updatedAt as Date).getTime() > 48 * 3600_000) {
        await resetAttempt(String(p._id));
        failed++;
      } else if (r === "failed") failed++;
    } catch (e) {
      console.error("[reconcile]", (e as Error).message);
    }
  }
  return { checked: stale.length, completed, failed };
}

async function notifyPaid(i: { purpose: string; userId: string; code: string; slug: string; invoiceNo: string; amount: number; planName: string }) {
  try {
    const u = await User.findById(i.userId).select("email emailVerified phone locale").lean();
    if (!u) return;
    const ne = u.locale === "ne";
    const loc = ne ? "ne" : "en";
    const next = i.purpose === "RENEWAL" ? absoluteUrl(loc, `/property/${i.slug}`) : absoluteUrl(loc, "/dashboard/listings");
    const text =
      i.purpose === "RENEWAL"
        ? ne
          ? `मन्त्रास्फियर: रु ${i.amount} भुक्तानी प्राप्त (${i.invoiceNo})। ${i.code} मा ${i.planName} योजना सक्रिय भयो। ${next}`
          : `MantraSphere: payment of Rs ${i.amount} received (${i.invoiceNo}). ${i.planName} plan is now active on ${i.code}. ${next}`
        : ne
          ? `मन्त्रास्फियर: रु ${i.amount} भुक्तानी प्राप्त (${i.invoiceNo})। ${i.code} जाँचका लागि पठाइयो। ${next}`
          : `MantraSphere: payment of Rs ${i.amount} received (${i.invoiceNo}). ${i.code} is now in review. ${next}`;
    const jobs: Promise<unknown>[] = [];
    if (u.phone) jobs.push(sendSms(u.phone, text));
    if (u.email && u.emailVerified) jobs.push(sendEmail({ to: u.email, subject: `Payment received – ${i.invoiceNo}`, text, html: `<p>${esc(text)}</p>` }));
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("[notify] paid", (e as Error).message);
  }
}
