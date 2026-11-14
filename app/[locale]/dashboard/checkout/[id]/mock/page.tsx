import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { accentBtn, outlineBtn } from "@/components/forms/styles";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { mockEnabled } from "@/lib/payments/mock";
import { loadOwnPayment } from "@/lib/payments/owner-view";
import { mockLinks } from "@/lib/payments/service";
import { formatPriceFull } from "@/lib/price";

/** Simulated gateway page (PAYMENT_MODE=mock only). */
export default async function MockGateway({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!mockEnabled()) notFound();
  const user = await requireUser(locale, `/${locale}/dashboard/checkout/${id}/mock`);
  const p = await loadOwnPayment(id, user.id);
  if (!p || p.status !== "INITIATED" || p.provider !== "MOCK") notFound();
  const links = mockLinks(p.id);
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-dashed border-saffron bg-card p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-price">Test payment gateway</p>
      <h1 className="mt-2 text-2xl font-bold">{formatPriceFull(p.amountNpr, "en")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{p.invoiceNo}</p>
      <div className="mt-6 flex flex-col gap-3">
        <a href={links.success} className={accentBtn}>
          Simulate successful payment
        </a>
        <a href={links.failure} className={outlineBtn}>
          Simulate failed payment
        </a>
      </div>
    </div>
  );
}
