import "server-only";
import { trusted } from "@/lib/db";

/** Shared filter for the admin leads list and its CSV export. */
export function leadsFilter(sp: { status?: string | null; source?: string | null; from?: string | null; to?: string | null; code?: string | null }) {
  const f: Record<string, unknown> = {};
  if (sp.status && ["NEW", "CONTACTED", "CLOSED"].includes(sp.status)) f.status = sp.status;
  if (sp.source && /^[A-Z_]{3,20}$/.test(sp.source)) f.source = sp.source;
  if (sp.code && /^MSR-\d{6,}$/i.test(sp.code)) f.propertyCode = sp.code.toUpperCase();
  const range: Record<string, Date> = {};
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) range.$gte = new Date(`${sp.from}T00:00:00+05:45`);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) range.$lte = new Date(`${sp.to}T23:59:59+05:45`);
  if (Object.keys(range).length) f.createdAt = trusted(range);
  return f;
}

/** CSV cell: quote, and neutralise spreadsheet formulas (CSV injection). */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
