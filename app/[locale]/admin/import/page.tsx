import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { IMPORT_COLUMNS } from "@/lib/admin/import-map";
import type { Locale } from "@/lib/constants";
import { ImportTool } from "./ImportTool";

export default async function ImportPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/import`, "import");
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Bulk import"
        intro="Import the company’s own listings. Check the file first: every row is validated like the listing wizard and errors are reported by row number. Photos are added afterwards from the listing."
      />
      <ImportTool />
      <details className="rounded-2xl border bg-card p-5 text-sm">
        <summary className="tap inline-flex cursor-pointer items-center font-semibold">Column reference</summary>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {IMPORT_COLUMNS.map((c) => (
            <li key={c} className="font-mono">
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-muted-foreground">
          Area: <code>1-4-0-0</code> with area_unit <code>ropani</code>, <code>2-5-0</code> with <code>bigha</code>, or a number with <code>sqft</code>/<code>sqm</code>. Price: <code>4500000</code>, <code>45 lakh</code> or{" "}
          <code>2.1 crore</code>. District and municipality accept English or Nepali names.
        </p>
      </details>
    </div>
  );
}
