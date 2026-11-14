import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/admin/audit";
import { can } from "@/lib/admin/auth";
import { csvCell, leadsFilter } from "@/lib/admin/leads-query";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { Lead } from "@/models";

/** GET /api/admin/leads?status=&source=&from=&to=&code= → CSV (staff only). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !can(user.role, "leads")) return new NextResponse("Not found", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const filter = leadsFilter(Object.fromEntries(sp.entries()));
  await connectDB();
  const rows = await Lead.find(filter).sort({ createdAt: -1 }).limit(50_000).lean();
  const head = ["created_at", "listing_code", "source", "status", "name", "phone", "email", "message"];
  const lines = [head.join(","), ...rows.map((r) => [r.createdAt, r.propertyCode, r.source, r.status, r.name, r.phone, r.email, r.message].map(csvCell).join(","))];
  await audit(user.id, "leads.export", "lead", "csv", null, { rows: rows.length, filter: Object.fromEntries(sp.entries()) });
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
