import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { loadOwned } from "@/lib/properties/owner";
import { Plan } from "@/models";
import { RenewForm } from "./RenewForm";

export default async function RenewPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/listings/${id}/renew`);
  const doc = await loadOwned(id, user.id);
  if (!doc || !["ACTIVE", "EXPIRED"].includes(doc.status)) notFound();
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const plans = await Plan.find({ active: true }).sort({ sortWeight: 1 }).lean();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("renewTitle", { code: doc.code })}</h1>
      <p className="mt-2 mb-6 text-muted-foreground">{t("renewIntro")}</p>
      <RenewForm
        listingId={id}
        locale={locale}
        current={doc.currentPlan ? String(doc.currentPlan) : null}
        plans={plans.map((p) => ({
          id: String(p._id),
          name: p.name?.[locale] || p.name?.en || p.slug,
          priceNpr: p.priceNpr,
          durationDays: p.durationDays ?? null,
          features: (p.features?.[locale]?.length ? p.features[locale] : p.features?.en) ?? [],
        }))}
      />
    </div>
  );
}
