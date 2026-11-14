import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { getSessionUser } from "@/lib/auth/session";
import { readPrivateFile } from "@/lib/storage";

/** Serve a private verification document or bank slip to staff only (never cached, never indexed). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !can(user.role, "verify")) return new NextResponse("Not found", { status: 404 });
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const isDoc = /^private:verification\/[a-f0-9]{24}\/[a-z_]+-[a-f0-9]{24}\.(jpg|pdf)$/.test(key);
  const isSlip = /^private:payments\/[a-f0-9]{24}\/slip-[a-f0-9]{24}\.(jpg|pdf)$/.test(key);
  if (!isDoc && !isSlip) return new NextResponse("Not found", { status: 404 });
  const buf = await readPrivateFile(key);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  await audit(user.id, isDoc ? "verification.view_document" : "payment.view_slip", isDoc ? "user" : "payment", key.split("/")[1], null, { key });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": key.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
