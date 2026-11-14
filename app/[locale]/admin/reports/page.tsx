import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Empty, PageHeader, Table, fmtDateTime } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { Property, Report } from "@/models";
import { ReportButtons } from "./ReportButtons";

const REASON: Record<string, string> = { SOLD: "Already sold/rented", WRONG_INFO: "Wrong information", DUPLICATE: "Duplicate", FRAUD: "Suspected fraud", OTHER: "Other" };

export default async function ReportsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/reports`, "moderate");
  await connectDB();
  const reports = await Report.find({ status: "OPEN" }).sort({ createdAt: 1 }).limit(300).lean();
  const props = new Map((await Property.find({ _id: trusted({ $in: reports.map((r) => r.property) }) }).select("code title status").lean()).map((p) => [String(p._id), p]));
  return (
    <div>
      <PageHeader title="Reports" intro="Listings reported by visitors. Open the listing to fix it, then resolve or dismiss the report." />
      {reports.length === 0 ? (
        <Empty>No open reports.</Empty>
      ) : (
        <Table caption="Open reports" head={["Listing", "Reason", "Details", "Reported", "Action"]}>
          {reports.map((r) => {
            const p = props.get(String(r.property));
            return (
              <tr key={String(r._id)} className="align-top">
                <td className="px-4 py-3">
                  {p ? (
                    <Link href={`/admin/listings/${p._id}`} className="font-semibold text-primary hover:underline">
                      {p.code}
                    </Link>
                  ) : (
                    "—"
                  )}
                  <div className="text-xs text-muted-foreground">{p?.title?.en}</div>
                </td>
                <td className="px-4 py-3">{REASON[r.reason] ?? r.reason}</td>
                <td className="max-w-sm px-4 py-3 whitespace-pre-line">{r.details || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(r.createdAt as Date)}</td>
                <td className="px-4 py-3">
                  <ReportButtons id={String(r._id)} />
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
