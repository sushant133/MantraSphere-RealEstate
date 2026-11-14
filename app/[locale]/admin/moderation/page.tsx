import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Empty, PageHeader, Pill, Table, fmtDateTime } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { WARNING_LABEL } from "@/lib/admin/labels";
import { formatPriceCompact } from "@/lib/price";
import { Payment, Plan, Property, User } from "@/models";


export default async function ModerationQueue({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/moderation`, "moderate");
  await connectDB();
  const items = await Property.find({ status: "PENDING_REVIEW" })
    .sort({ submittedAt: 1 })
    .select("code title type purpose priceNpr priceOnRequest owner submittedAt validationWarnings requestedPlan locationNames")
    .limit(200)
    .lean();
  const owners = new Map((await User.find({ _id: trusted({ $in: items.map((i) => i.owner) }) }).select("name phone email verified").lean()).map((u) => [String(u._id), u]));
  const plans = new Map((await Plan.find().select("name").lean()).map((p) => [String(p._id), p.name?.en ?? ""]));
  const paid = new Set((await Payment.find({ property: trusted({ $in: items.map((i) => i._id) }), purpose: "NEW_LISTING", status: "COMPLETED" }).select("property").lean()).map((p) => String(p.property)));

  return (
    <div>
      <PageHeader title="Moderation queue" intro="Oldest first. Check warnings, then approve with a plan or send back with a reason." />
      {items.length === 0 ? (
        <Empty>Nothing to review — the queue is empty.</Empty>
      ) : (
        <Table caption="Listings awaiting review" head={["Listing", "Owner", "Price", "Plan", "Warnings", "Submitted"]}>
          {items.map((p) => {
            const o = owners.get(String(p.owner));
            return (
              <tr key={String(p._id)} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/admin/moderation/${p._id}`} className="font-semibold text-primary hover:underline">
                    {p.title?.en || p.code}
                  </Link>
                  <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                </td>
                <td className="px-4 py-3">
                  {o?.name || o?.phone || o?.email || "—"} {o?.verified ? <Pill tone="good">verified</Pill> : null}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{p.priceOnRequest ? "On request" : p.priceNpr ? formatPriceCompact(p.priceNpr) : "—"}</td>
                <td className="px-4 py-3">
                  {p.requestedPlan ? plans.get(String(p.requestedPlan)) : "—"}{" "}
                  {paid.has(String(p._id)) ? <Pill tone="good">paid</Pill> : <Pill tone="neutral">unpaid (staff/import)</Pill>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(p.validationWarnings ?? []).map((w) => (
                      <Pill key={w} tone="warn">
                        {WARNING_LABEL[w.split(":")[0]] ?? w}
                      </Pill>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(p.submittedAt)}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
