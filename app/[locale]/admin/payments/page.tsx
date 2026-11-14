import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Empty, PageHeader, Pill, Table, fmtDateTime } from "@/components/admin/ui";
import { primaryBtn, selectCls } from "@/components/forms/styles";
import { requireStaff } from "@/lib/admin/auth";
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES, type Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/phone";
import { groupNepali } from "@/lib/price";
import { Payment, Plan, Property, User } from "@/models";
import { BankDecision } from "./BankDecision";

const TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = { COMPLETED: "good", PENDING_VERIFICATION: "warn", INITIATED: "neutral", FAILED: "bad", REFUNDED: "neutral" };

export default async function AdminPayments({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string; provider?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/payments`, "moderate");
  const sp = await searchParams;
  const status = PAYMENT_STATUSES.includes(sp.status as never) ? sp.status : sp.status === "all" ? undefined : "PENDING_VERIFICATION";
  const provider = PAYMENT_PROVIDERS.includes(sp.provider as never) ? sp.provider : undefined;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (provider) filter.provider = provider;
  await connectDB();
  const pays = await Payment.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  const [users, plans, props, totals] = await Promise.all([
    User.find({ _id: trusted({ $in: pays.map((p) => p.user) }) }).select("name phone email").lean(),
    Plan.find({ _id: trusted({ $in: pays.map((p) => p.plan) }) }).select("name").lean(),
    Property.find({ _id: trusted({ $in: pays.map((p) => p.property) }) }).select("code").lean(),
    Payment.aggregate<{ _id: string; n: number; sum: number }>([{ $group: { _id: "$status", n: { $sum: 1 }, sum: { $sum: "$amountNpr" } } }]),
  ]);
  const U = new Map(users.map((u) => [String(u._id), u]));
  const P = new Map(plans.map((p) => [String(p._id), p.name?.en ?? ""]));
  const C = new Map(props.map((p) => [String(p._id), { code: p.code, id: String(p._id) }]));
  const completed = totals.find((t) => t._id === "COMPLETED");

  return (
    <div>
      <PageHeader title="Payments" intro={`Collected: Rs ${groupNepali(completed?.sum ?? 0)} from ${completed?.n ?? 0} payments. Bank transfers wait here for verification.`} />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3" aria-label="Filter payments">
        <div>
          <label htmlFor="ps" className="text-sm font-semibold">Status</label>
          <select id="ps" name="status" defaultValue={sp.status ?? "PENDING_VERIFICATION"} className={selectCls}>
            <option value="all">All</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pp" className="text-sm font-semibold">Method</label>
          <select id="pp" name="provider" defaultValue={provider ?? ""} className={selectCls}>
            <option value="">Any</option>
            {PAYMENT_PROVIDERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={primaryBtn}>
          Filter
        </button>
      </form>
      {pays.length === 0 ? (
        <Empty>No payments match.</Empty>
      ) : (
        <Table caption="Payments" head={["Invoice", "Payer", "Listing / plan", "Amount", "Method", "Status", "Updated"]}>
          {pays.map((p) => {
            const u = U.get(String(p.user));
            const c = C.get(String(p.property));
            return (
              <tr key={String(p._id)} className="align-top">
                <td className="px-4 py-3 font-mono">
                  {p.status === "COMPLETED" ? (
                    <a href={`/api/invoices/${p._id}`} target="_blank" rel="noopener" className="text-primary hover:underline">
                      {p.invoiceNo}
                    </a>
                  ) : (
                    p.invoiceNo
                  )}
                </td>
                <td className="px-4 py-3">
                  {u?.name || u?.email || "—"}
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {u?.phone ? formatPhoneDisplay(u.phone) : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c ? (
                    <Link href={`/admin/listings/${c.id}`} className="font-mono text-primary hover:underline">
                      {c.code}
                    </Link>
                  ) : (
                    "—"
                  )}
                  <div className="text-xs">
                    {P.get(String(p.plan))} · {p.purpose === "RENEWAL" ? "renewal" : "new listing"}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">Rs {groupNepali(p.amountNpr)}</td>
                <td className="px-4 py-3">
                  {p.provider ?? "—"}
                  {p.bankReference ? <div className="text-xs">Ref: {p.bankReference}</div> : null}
                  {p.bankSlipUrl ? (
                    <a href={`/api/admin/files?key=${encodeURIComponent(p.bankSlipUrl)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                      View slip
                    </a>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Pill tone={TONE[p.status] ?? "neutral"}>{p.status}</Pill>
                  {p.failureReason ? <div className="mt-1 text-xs text-muted-foreground">{p.failureReason}</div> : null}
                  {p.status === "PENDING_VERIFICATION" ? <BankDecision id={String(p._id)} /> : null}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(p.updatedAt as Date)}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
