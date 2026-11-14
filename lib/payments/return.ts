import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/seo";

/** Where gateways send the browser back to (locale from next-intl's cookie). */
export function resultRedirect(req: NextRequest, paymentId: string) {
  const loc = req.cookies.get("NEXT_LOCALE")?.value === "ne" ? "ne" : "en";
  const safe = /^[a-f0-9]{24}$/.test(paymentId) ? paymentId : "";
  return NextResponse.redirect(`${SITE_URL}/${loc}/dashboard/checkout/${safe}/result`, 303);
}
