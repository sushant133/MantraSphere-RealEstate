import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { can } from "@/lib/admin/auth";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/phone";
import { groupNepali } from "@/lib/price";
import { getSiteSettings } from "@/lib/site";
import { Payment, Plan, Property, User } from "@/models";

/** PDF receipt for a completed payment (owner or staff). Latin text only (standard PDF fonts). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !mongoose.isValidObjectId(id)) return new NextResponse("Not found", { status: 404 });
  await connectDB();
  const pay = await Payment.findById(id).lean();
  if (!pay || pay.status !== "COMPLETED" || (String(pay.user) !== user.id && !can(user.role, "leads"))) return new NextResponse("Not found", { status: 404 });
  const [plan, prop, buyer, s] = await Promise.all([
    Plan.findById(pay.plan).lean(),
    Property.findById(pay.property).select("code title").lean(),
    User.findById(pay.user).select("name email phone").lean(),
    getSiteSettings(),
  ]);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.12, 0.16, 0.36);
  const grey = rgb(0.4, 0.42, 0.5);
  // Standard fonts are WinAnsi-only: drop anything they cannot encode (e.g. Devanagari).
  const latin = (t: string) => t.replace(/[^\x20-\x7E -ÿ–—’]/g, "").trim();
  let y = 790;
  const text = (t: string, x: number, size = 11, f = font, color = rgb(0.1, 0.1, 0.15)) => page.drawText(latin(t), { x, y, size, font: f, color });

  text(s.companyName.en, 50, 20, bold, navy);
  y -= 18;
  text(s.legalName, 50, 10, font, grey);
  y -= 14;
  text(s.address.en, 50, 10, font, grey);
  y -= 14;
  text([s.phones.map(formatPhoneDisplay).join(", "), s.email].join("  ·  "), 50, 10, font, grey);
  if (s.panNo) {
    y -= 14;
    text(`PAN: ${s.panNo}`, 50, 10, font, grey);
  }
  y -= 40;
  text("PAYMENT RECEIPT", 50, 16, bold, navy);
  y -= 26;
  const row = (k: string, v: string) => {
    text(k, 50, 11, font, grey);
    text(v, 200, 11, bold);
    y -= 20;
  };
  row("Receipt no.", pay.invoiceNo);
  row("Date paid", new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(pay.paidAt ?? pay.updatedAt));
  row("Billed to", buyer?.name || buyer?.email || (buyer?.phone ? formatPhoneDisplay(buyer.phone) : "-"));
  row("Listing", `${prop?.code ?? "-"}  ${prop?.title?.en ?? ""}`.slice(0, 70));
  row("Plan", `${plan?.name?.en ?? "-"} (${plan?.durationDays ? `${plan.durationDays} days` : "until sold"})${pay.purpose === "RENEWAL" ? " - renewal" : ""}`);
  const METHOD: Record<string, string> = { ESEWA: "eSewa", KHALTI: "Khalti", BANK_TRANSFER: "Bank transfer", MOCK: "Test gateway" };
  row("Payment method", METHOD[pay.provider ?? ""] ?? "-");
  if (pay.providerTxnId) row("Transaction ID", pay.providerTxnId);
  if (pay.bankReference) row("Bank reference", pay.bankReference);
  y -= 10;
  page.drawLine({ start: { x: 50, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 1, color: rgb(0.85, 0.86, 0.9) });
  y -= 14;
  text("Amount paid", 50, 13, bold);
  text(`Rs ${groupNepali(pay.amountNpr)}`, 200, 13, bold, navy);
  y -= 50;
  text("Thank you for listing with MantraSphere Real Estate.", 50, 10, font, grey);

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pay.invoiceNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
