import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { resultRedirect } from "@/lib/payments/return";
import { verifyGatewayPayment } from "@/lib/payments/service";
import { Payment } from "@/models";

/** Khalti return. Query params are only hints; the lookup API decides. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pid = sp.get("pid") ?? "";
  if (!/^[a-f0-9]{24}$/.test(pid)) return resultRedirect(req, "");
  await connectDB();
  const pay = await Payment.findById(pid).select("providerRef provider").lean();
  if (pay?.provider === "KHALTI" && sp.get("pidx") === pay.providerRef) {
    await verifyGatewayPayment(pid).catch((e) => console.error("[khalti]", (e as Error).message));
  }
  return resultRedirect(req, pid);
}
