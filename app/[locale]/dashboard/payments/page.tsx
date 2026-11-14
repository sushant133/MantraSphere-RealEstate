import { FileDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { formatDate } from "@/lib/properties/format";
import { formatPriceFull } from "@/lib/price";
import { cn } from "@/lib/utils";
import { Payment, Plan, Property } from "@/models";

const TONE: Record<string, string> = {
  COMPLETED: "bg-success/15 text-success",
  INITIATED: "bg-saffron/25",
  PENDING_VERIFICATION: "bg-saffron/25",
  FAILED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-muted",
};

export default async function PaymentsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/payments`);
  const t = await getTranslations({ locale, namespace: "dashboard" });
  await connectDB();
  const pays = await Payment.find({ user: user.id }).sort({ createdAt: -1 }).limit(200).lean();
  const [plans, props] = await Promise.all([
    Plan.find({ _id: trusted({ $in: pays.map((p) => p.plan) }) }).select("name").lean(),
    Property.find({ _id: trusted({ $in: pays.map((p) => p.property) }) }).select("code").lean(),
  ]);
  const planName = new Map(plans.map((p) => [String(p._id), p.name?.[locale] || p.name?.en || ""]));
  const code = new Map(props.map((p) => [String(p._id), p.code]));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("paymentsTitle")}</h1>
      {pays.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("paymentsEmpty")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {pays.map((p) => (
            <li key={String(p._id)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div>
                <p className="font-semibold">
                  {p.invoiceNo} · {formatPriceFull(p.amountNpr, locale)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`purpose.${p.purpose as "NEW_LISTING"}`)} · {planName.get(String(p.plan))} · <span className="font-mono">{code.get(String(p.property))}</span> · {formatDate((p.createdAt as Date).toISOString(), locale)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", TONE[p.status])}>{t(`paymentStatus.${p.status as "COMPLETED"}`)}</span>
                {p.status === "COMPLETED" ? (
                  <a href={`/api/invoices/${p._id}`} target="_blank" rel="noopener" className="tap inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
                    <FileDown className="size-4" aria-hidden="true" />
                    {t("downloadReceipt")}
                  </a>
                ) : p.status === "INITIATED" ? (
                  <Link href={`/dashboard/checkout/${p._id}`} className="tap inline-flex items-center rounded-xl bg-saffron px-3 text-sm font-semibold text-saffron-foreground">
                    {t("payNow")}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
