import "server-only";
import { activateListing } from "./activation";
import { audit } from "./audit";
import { connectDB } from "@/lib/db";
import { nextPropertyCode } from "@/lib/counters";
import { applyDraft, submitForReview } from "@/lib/properties/owner";
import { District, Municipality, Plan, Property } from "@/models";
import { mapRow, parseCsv, type Lookup, type MappedRow } from "./import-map";

export const MAX_IMPORT_ROWS = 500;

async function readRows(buf: Buffer, filename: string): Promise<Record<string, unknown>[]> {
  if (/\.xlsx$/i.test(filename)) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const head: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (head[i - 1] = String(c.text ?? "")));
    const out: Record<string, unknown>[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      const rec: Record<string, unknown> = {};
      head.forEach((h, i) => (rec[h] = row.getCell(i + 1).text ?? ""));
      out.push(rec);
    });
    return out;
  }
  return parseCsv(buf.toString("utf8"));
}

async function buildLookup(): Promise<Lookup & { planId: (slug: string) => string | null }> {
  await connectDB();
  const [districts, munis, plans] = await Promise.all([District.find().lean(), Municipality.find().select("name district wards").lean(), Plan.find().select("slug").lean()]);
  const key = (s: string) => s.trim().toLowerCase();
  const dmap = new Map<string, (typeof districts)[number]>();
  for (const d of districts) for (const k of [d.name.en, d.name.ne, d.slug]) dmap.set(key(k), d);
  return {
    district: (n) => {
      const d = dmap.get(key(n));
      return d ? { id: String(d._id), terai: d.region === "TERAI" } : null;
    },
    municipality: (did, n) => {
      const m = munis.find((x) => String(x.district) === did && [x.name.en, x.name.ne].some((v) => key(v) === key(n) || key(v).replace(/\s+(municipality|rural municipality|metropolitan city|sub-metropolitan city)$/, "") === key(n)));
      return m ? { id: String(m._id), wards: m.wards ?? 40 } : null;
    },
    planExists: (s) => plans.some((p) => p.slug === s),
    planId: (s) => {
      const p = plans.find((x) => x.slug === s);
      return p ? String(p._id) : null;
    },
  };
}

export type ImportReport = { total: number; valid: number; rows: MappedRow[]; created: { row: number; code: string; status: string }[]; truncated: boolean };

/**
 * Validate (dry run) or import rows. Imported rows belong to the importing
 * staff account (company listings). "publish = yes" rows that pass every
 * check go live on their plan; others are saved as drafts for staff to finish.
 */
export async function runImport(buf: Buffer, filename: string, actorId: string, commit: boolean): Promise<ImportReport> {
  const raw = await readRows(buf, filename);
  const lk = await buildLookup();
  const rows = raw.slice(0, MAX_IMPORT_ROWS).map((rec, i) => mapRow(i + 2, rec, lk)); // +2: header is row 1
  const report: ImportReport = { total: raw.length, valid: rows.filter((r) => r.draft && !r.errors.length).length, rows, created: [], truncated: raw.length > MAX_IMPORT_ROWS };
  if (!commit) return report;

  for (const r of rows) {
    if (!r.draft || r.errors.length) continue;
    const code = await nextPropertyCode();
    const doc = new Property({
      code,
      slug: `draft-${code.toLowerCase()}`,
      title: { en: "", ne: "" },
      purpose: r.draft.purpose,
      type: r.draft.type,
      status: "DRAFT",
      owner: actorId,
      postedBy: "COMPANY",
    });
    await applyDraft(doc, r.draft);
    await doc.save();
    let status = "DRAFT";
    if (r.publish && r.issues.length === 0) {
      const sub = await submitForReview(doc, actorId);
      const planId = lk.planId(r.draft.planSlug ?? "normal");
      if (sub.ok && planId) {
        await activateListing({ propertyId: String(doc._id), planId, actorId });
        status = "ACTIVE";
      } else if (sub.ok) status = "PENDING_REVIEW";
    }
    report.created.push({ row: r.row, code, status });
  }
  await audit(actorId, "import.commit", "import", filename.slice(0, 80), null, { created: report.created.length, total: report.total });
  return report;
}
