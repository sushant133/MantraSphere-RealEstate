import { setRequestLocale } from "next-intl/server";
import { Empty, PageHeader, Pill, Table, fmtDateTime } from "@/components/admin/ui";
import { inputCls, outlineBtn, primaryBtn, selectCls } from "@/components/forms/styles";
import { requireStaff } from "@/lib/admin/auth";
import { leadsFilter } from "@/lib/admin/leads-query";
import { LEAD_SOURCES, type Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/phone";
import { Lead } from "@/models";

type SP = { status?: string; source?: string; from?: string; to?: string; code?: string };

export default async function AdminLeads({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/leads`, "leads");
  const sp = await searchParams;
  await connectDB();
  const filter = leadsFilter(sp);
  const [leads, total] = await Promise.all([Lead.find(filter).sort({ createdAt: -1 }).limit(200).lean(), Lead.countDocuments(filter)]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <div>
      <PageHeader
        title="Leads"
        intro={`${total} leads${total > 200 ? " (showing the latest 200; export for all)" : ""}`}
        actions={
          <a href={`/api/admin/leads${qs ? `?${qs}` : ""}`} className={outlineBtn}>
            Export CSV
          </a>
        }
      />
      <form method="get" role="search" aria-label="Filter leads" className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <div>
          <label htmlFor="lc" className="text-sm font-semibold">Listing code</label>
          <input id="lc" name="code" defaultValue={sp.code ?? ""} placeholder="MSR-000123" className={inputCls} />
        </div>
        <div>
          <label htmlFor="lst" className="text-sm font-semibold">Status</label>
          <select id="lst" name="status" defaultValue={sp.status ?? ""} className={selectCls}>
            <option value="">Any</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div>
          <label htmlFor="lsr" className="text-sm font-semibold">Source</label>
          <select id="lsr" name="source" defaultValue={sp.source ?? ""} className={selectCls}>
            <option value="">Any</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lf" className="text-sm font-semibold">From</label>
          <input id="lf" type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="lt" className="text-sm font-semibold">To</label>
          <input id="lt" type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} />
        </div>
        <button type="submit" className={primaryBtn}>
          Filter
        </button>
      </form>
      {leads.length === 0 ? (
        <Empty>No leads match.</Empty>
      ) : (
        <Table caption="Leads" head={["When", "Listing", "Source", "Status", "Contact", "Message"]}>
          {leads.map((l) => (
            <tr key={String(l._id)} className="align-top">
              <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(l.createdAt as Date)}</td>
              <td className="px-4 py-3 font-mono">{l.propertyCode ?? "—"}</td>
              <td className="px-4 py-3">{l.source}</td>
              <td className="px-4 py-3">
                <Pill tone={l.status === "NEW" ? "warn" : l.status === "CLOSED" ? "neutral" : "info"}>{l.status}</Pill>
              </td>
              <td className="px-4 py-3">
                {l.name ?? "—"}
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {l.phone ? formatPhoneDisplay(l.phone) : ""} {l.email ?? ""}
                </div>
              </td>
              <td className="max-w-sm px-4 py-3 whitespace-pre-line">{l.message ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
