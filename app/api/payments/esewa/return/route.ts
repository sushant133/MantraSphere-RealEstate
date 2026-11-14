import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { esewaDecode } from "@/lib/payments/esewa";
import { resultRedirect } from "@/lib/payments/return";
import { verifyGatewayPayment } from "@/lib/payments/service";
import { Payment } from "@/models";

/**
 * eSewa success/failure return. The `data` blob is signature-checked and must
 * match the attempt we started, then eSewa's status API decides (server-to-server).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pid = sp.get("pid") ?? "";
  if (!/^[a-f0-9]{24}$/.test(pid)) return resultRedirect(req, "");
  const data = esewaDecode(sp.get("data") ?? "");
  await connectDB();
  const pay = await Payment.findById(pid).select("providerRef provider").lean();
  // Failure redirects carry no signed data; the status API still decides
  // (a stray failure redirect can never discard a real payment).
  if (pay?.provider === "ESEWA" && (sp.get("failed") || data?.transaction_uuid === pay.providerRef)) {
    await verifyGatewayPayment(pid).catch((e) => console.error("[esewa]", (e as Error).message));
  }
  return resultRedirect(req, pid);
}
