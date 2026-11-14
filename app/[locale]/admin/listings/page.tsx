import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Empty, PageHeader, Pill, STATUS_TONE, Table, fmtDate } from "@/components/admin/ui";
import { inputCls, primaryBtn, selectCls } from "@/components/forms/styles";
import { requireStaff } from "@/lib/admin/auth";
import { PROPERTY_STATUSES, type Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { formatPriceCompact } from "@/lib/price";
import { escapeRegex } from "@/lib/sanitize";
import { Property } from "@/models";

const PAGE = 50;

export default async function AdminListings({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/listings`, "listings");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const status = PROPERTY_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    const phone = normalizePhone(q);
    filter.$or = /^msr-\d+$/i.test(q)
      ? [{ code: q.toUpperCase() }]
      : phone
        ? [{ contactPhone: phone.e164 }]
        : [{ "title.en": trusted({ $regex: escapeRegex(q), $options: "i" }) }, { address: trusted({ $regex: escapeRegex(q), $options: "i" }) }];
  }
  await connectDB();
  const [items, total] = await Promise.all([
    Property.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * PAGE).limit(PAGE).select("code title status tier priceNpr priceOnRequest priceUnit views leadsCount updatedAt isDemo").lean(),
    Property.countDocuments(filter),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();

  return (
    <div>
      <PageHeader title="Listings" intro={`${total} listings`} />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3" role="search" aria-label="Search listings">
        <div className="min-w-56 flex-1">
          <label htmlFor="lq" className="text-sm font-semibold">
            Code, title, address or contact phone
          </label>
          <input id="lq" name="q" defaultValue={q} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ls" className="text-sm font-semibold">
            Status
          </label>
          <select id="ls" name="status" defaultValue={status ?? ""} className={selectCls}>
            <option value="">Any</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={primaryBtn}>
          Search
        </button>
      </form>
      {items.length === 0 ? (
        <Empty>No listings match.</Empty>
      ) : (
        <Table caption="Listings" head={["Code", "Title", "Status", "Tier", "Price", "Views / leads", "Updated"]}>
          {items.map((p) => (
            <tr key={String(p._id)}>
              <td className="px-4 py-3 font-mono">
                <Link href={`/admin/listings/${p._id}`} className="text-primary hover:underline">
                  {p.code}
                </Link>
              </td>
              <td className="max-w-xs truncate px-4 py-3">
                {p.title?.en || "—"} {p.isDemo ? <Pill>demo</Pill> : null}
              </td>
              <td className="px-4 py-3">
                <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
              </td>
              <td className="px-4 py-3">{p.tier}</td>
              <td className="px-4 py-3 whitespace-nowrap">{p.priceOnRequest ? "On request" : p.priceNpr ? formatPriceCompact(p.priceNpr) : "—"}</td>
              <td className="px-4 py-3 tabular-nums">
                {p.views ?? 0} / {p.leadsCount ?? 0}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.updatedAt as Date)}</td>
            </tr>
          ))}
        </Table>
      )}
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex gap-2">
          {page > 1 ? (
            <Link href={`/admin/listings?${qs(page - 1)}`} className="tap inline-flex items-center rounded-xl border px-4 text-sm">
              Previous
            </Link>
          ) : null}
          <span className="inline-flex items-center px-2 text-sm">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/listings?${qs(page + 1)}`} className="tap inline-flex items-center rounded-xl border px-4 text-sm">
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
