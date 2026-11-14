import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Gallery } from "@/components/property/Gallery";
import { KeyFacts } from "@/components/property/KeyFacts";
import { PropertyCard } from "@/components/property/PropertyCard";
import { outlineBtn } from "@/components/forms/styles";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { toDetailDTO } from "@/lib/properties/dto";
import { displayPrice, placeLine } from "@/lib/properties/format";
import { loadOwned } from "@/lib/properties/owner";
import { District } from "@/models";

/** What buyers will see, for the owner only (any status). */
export default async function PreviewPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/listings/${id}/preview`);
  const doc = await loadOwned(id, user.id);
  if (!doc) notFound();
  const [t, tc] = await Promise.all([getTranslations({ locale, namespace: "dashboard" }), getTranslations({ locale, namespace: "common" })]);
  const back = (
    <Link href={`/dashboard/listings/${id}/edit`} className={outlineBtn}>
      {t("backToEditing")}
    </Link>
  );
  if (!doc.locationNames?.district?.en) {
    return (
      <div className="space-y-4 rounded-2xl border p-6">
        <p>{t("previewIncomplete")}</p>
        {back}
      </div>
    );
  }
  await connectDB();
  const region = (await District.findById(doc.district).select("region").lean())?.region === "TERAI" ? "TERAI" : "HILL";
  const p = toDetailDTO(doc.toObject(), { amenities: [], ownerVerified: false });
  const price = displayPrice(p, locale);

  return (
    <div className="space-y-8">
      <p role="status" className="flex items-center gap-2 rounded-xl bg-saffron/20 p-3 text-sm font-medium">
        <Eye className="size-4" aria-hidden="true" />
        {t("previewBanner")}
      </p>
      {back}
      <Gallery images={p.images} title={p.title[locale] || p.code} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{p.title[locale] || t("untitled")}</h1>
        <p className="mt-1 text-muted-foreground">{placeLine(p.locationNames, p.address, locale)}</p>
        <p className="mt-3 text-3xl font-bold text-price">{price ? `${price.main} ${price.suffix}` : tc("priceOnRequest")}</p>
      </div>
      <KeyFacts p={p} locale={locale} region={region} />
      {p.description[locale] || p.description.en ? <p className="whitespace-pre-line leading-relaxed">{p.description[locale] || p.description.en}</p> : null}
      <div className="max-w-sm">
        <PropertyCard p={p} headingLevel={2} />
      </div>
    </div>
  );
}
