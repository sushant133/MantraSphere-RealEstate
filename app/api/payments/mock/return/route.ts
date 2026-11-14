import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { resultRedirect } from "@/lib/payments/return";
import { completePayment, resetAttempt } from "@/lib/payments/service";
import { mockEnabled, mockVerify } from "@/lib/payments/mock";
import { Payment } from "@/models";

/** Simulated gateway return (PAYMENT_MODE=mock only, signed links). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pid = sp.get("pid") ?? "";
  if (!/^[a-f0-9]{24}$/.test(pid)) return resultRedirect(req, "");
  if (mockVerify(pid, sp.get("result") ?? "", sp.get("sig") ?? "")) {
    await connectDB();
    const pay = await Payment.findById(pid).select("provider providerRef").lean();
    if (pay?.provider === "MOCK") await completePayment(pid, { txnId: `MOCK-${pay.providerRef}`, raw: { mock: true } });
  } else if (mockEnabled() && sp.get("result") === "failure") {
    await resetAttempt(pid);
  }
  return resultRedirect(req, pid);
}
