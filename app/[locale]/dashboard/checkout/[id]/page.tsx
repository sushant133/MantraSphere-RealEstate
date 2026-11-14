import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { loadOwnPayment } from "@/lib/payments/owner-view";
import { enabledProviders } from "@/lib/payments/service";
import { formatPriceFull, toDevanagariDigits } from "@/lib/price";
import { SiteSetting } from "@/models";
import { CheckoutMethods } from "./CheckoutMethods";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/checkout/${id}`);
  const p = await loadOwnPayment(id, user.id);
  if (!p) notFound();
  if (p.status !== "INITIATED") redirect(`/${locale}/dashboard/checkout/${id}/result`);
  const t = await getTranslations({ locale, namespace: "checkout" });
  await connectDB();
  const banks = ((await SiteSetting.findById("site").select("bankAccounts").lean())?.bankAccounts ?? []).map((b) => ({
    bank: b.bank ?? "",
    accountName: b.accountName ?? "",
    accountNumber: b.accountNumber ?? "",
    branch: b.branch ?? "",
  }));
  const n = (v: number) => (locale === "ne" ? toDevanagariDigits(String(v)) : String(v));

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <section aria-labelledby="summary" className="h-fit rounded-3xl border bg-card p-6 lg:order-2 lg:col-span-2">
        <h2 id="summary" className="font-semibold">
          {t("summary")}
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("listing")}</dt>
            <dd className="font-medium">
              {p.listing?.title[locale] || p.listing?.code} <span className="font-mono text-xs text-muted-foreground">{p.listing?.code}</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("plan")}</dt>
            <dd className="font-medium">{p.planName[locale]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("duration")}</dt>
            <dd>{p.durationDays ? t("days", { count: n(p.durationDays) }) : t("untilSold")}</dd>
          </div>
          <div className="flex justify-between border-t pt-3 text-base">
            <dt className="font-semibold">{t("total")}</dt>
            <dd className="font-bold text-price">{formatPriceFull(p.amountNpr, locale)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">{t("invoice", { no: p.invoiceNo })}</p>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
          {t("secureNote")}
        </p>
      </section>
      <div className="lg:col-span-3">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("title")}</h1>
        <CheckoutMethods paymentId={p.id} providers={enabledProviders()} banks={banks} locale={locale} />
      </div>
    </div>
  );
}
