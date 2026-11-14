import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/admin/auth";
import { runImport } from "@/lib/admin/import";
import { IMPORT_COLUMNS, IMPORT_EXAMPLE } from "@/lib/admin/import-map";
import { csvCell } from "@/lib/admin/leads-query";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 5 * 1024 * 1024;

/** GET → CSV template. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !can(user.role, "import")) return new NextResponse("Not found", { status: 404 });
  const body = [IMPORT_COLUMNS.join(","), IMPORT_COLUMNS.map((c) => csvCell(IMPORT_EXAMPLE[c])).join(",")].join("\r\n");
  return new NextResponse("﻿" + body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="mantrasphere-import-template.csv"' },
  });
}

/** POST multipart { file, mode: "dry" | "commit" } → validation report (and created listings on commit). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !can(user.role, "import")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!rateLimit(`import:${user.id}`, 30, 60 * 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const mode = form?.get("mode") === "commit" ? "commit" : "dry";
  if (!(file instanceof File) || !/\.(csv|xlsx)$/i.test(file.name)) return NextResponse.json({ error: "Upload a .csv or .xlsx file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 5 MB" }, { status: 413 });
  try {
    const report = await runImport(Buffer.from(await file.arrayBuffer()), file.name, user.id, mode === "commit");
    return NextResponse.json(report);
  } catch (e) {
    console.error("[import]", (e as Error).message);
    return NextResponse.json({ error: "The file could not be read" }, { status: 400 });
  }
}
