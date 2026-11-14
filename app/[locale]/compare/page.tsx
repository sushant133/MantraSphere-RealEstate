import type { Metadata } from "next";
import Image from "next/image";
import { GitCompareArrows } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { IntlScope } from "@/components/IntlScope";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import type { PropertyDetailDTO } from "@/lib/properties/dto";
import { displayArea, displayPrice, localDigits, placeLine } from "@/lib/properties/format";
import { getCardsByCodes, getPropertyDetail } from "@/lib/properties/queries";
import { formatPriceFull } from "@/lib/price";
import { pageMetadata } from "@/lib/seo";
import { RemoveFromCompare } from "./RemoveFromCompare";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ codes?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compare" });
  return pageMetadata({ locale, path: "/compare", title: t("title"), description: t("description"), noindex: true });
}

export default async function ComparePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).codes ?? "";
  const codes = [...new Set(raw.split(",").map((c) => c.trim().toUpperCase()))].filter((c) => /^MSR-\d{6,}$/.test(c)).slice(0, 3);
  const [t, tp, td, cards] = await Promise.all([
    getTranslations({ locale, namespace: "compare" }),
    getTranslations({ locale, namespace: "property" }),
    getTranslations({ locale, namespace: "detail" }),
    getCardsByCodes(codes),
  ]);
  const items = (await Promise.all(cards.map((c) => getPropertyDetail(c.slug)))).filter((x): x is PropertyDetailDTO => !!x);

  const dash = "—";
  const yesNo = (v: boolean | null) => (v == null ? dash : v ? t("yes") : t("no"));
  const num = (v: number | null | undefined, suffix = "") => (v == null ? dash : localDigits(`${v}${suffix}`, locale));

  // Price per sq ft helps compare land of different sizes.
  const perSqft = (p: PropertyDetailDTO) =>
    p.purpose === "SALE" && p.priceTotalNpr && p.areaSqFt ? formatPriceFull(Math.round(p.priceTotalNpr / p.areaSqFt), locale) : dash;

  const rows: { label: string; get: (p: PropertyDetailDTO) => string }[] = [
    { label: t("price"), get: (p) => { const pr = displayPrice(p, locale); return pr ? `${pr.main}${pr.suffix ? ` ${pr.suffix}` : ""}` : t("onRequest"); } },
    { label: t("pricePerSqft"), get: perSqft },
    { label: t("type"), get: (p) => `${t(`types.${p.type}` as "types.LAND")} · ${tp(`purpose.${p.purpose}`)}` },
    { label: t("location"), get: (p) => placeLine(p.locationNames, p.address, locale) },
    { label: t("area"), get: (p) => (displayArea(p, locale) ? localDigits(displayArea(p, locale)!, locale) : dash) },
    { label: t("builtUp"), get: (p) => (p.builtUpAreaSqFt ? localDigits(`${p.builtUpAreaSqFt} sq ft`, locale) : dash) },
    { label: t("bedrooms"), get: (p) => num(p.bedrooms) },
    { label: t("bathrooms"), get: (p) => num(p.bathrooms) },
    { label: t("floors"), get: (p) => num(p.floors) },
    { label: t("parking"), get: (p) => num(p.parking) },
    { label: t("facing"), get: (p) => (p.facing ? tp(`facing.${p.facing}` as "facing.EAST") : dash) },
    { label: t("road"), get: (p) => (p.roadWidthFt ? localDigits(`${p.roadWidthFt} ft`, locale) : dash) },
    { label: t("mainRoad"), get: (p) => (p.mainRoadDistanceM != null ? localDigits(`${p.mainRoadDistanceM} m`, locale) : dash) },
    { label: t("furnishing"), get: (p) => (p.furnishing ? td(`furnishing.${p.furnishing}` as "furnishing.UNFURNISHED") : dash) },
    { label: t("builtYear"), get: (p) => num(p.builtYear) },
    { label: t("ready"), get: (p) => yesNo(p.readyToMove) },
    { label: t("amenities"), get: (p) => (p.amenities.length ? p.amenities.map((a) => a.name[locale]).join(", ") : dash) },
    { label: t("verified"), get: (p) => yesNo(p.ownerVerified) },
    { label: t("code"), get: (p) => p.code },
  ];

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title") }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary">{t("title")}</h1>
      {items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <GitCompareArrows className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 max-w-md font-medium">{t("empty")}</p>
          <Link href="/properties" className="tap mt-6 inline-flex items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <>
          {items.length === 1 ? <p className="mt-2 text-muted-foreground">{t("addMore")}</p> : null}
          <div className="mt-6 overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <caption className="sr-only">{t("caption")}</caption>
              <thead>
                <tr>
                  <td className="w-40 border-b p-4" />
                  {items.map((p) => (
                    <th key={p.code} scope="col" className="border-b p-4 text-left align-top font-normal">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                        {p.cover ? <Image src={p.cover.url} alt="" fill sizes="300px" className="object-cover" /> : null}
                      </div>
                      <Link href={`/property/${p.slug}`} className="mt-3 line-clamp-2 block font-semibold text-primary hover:underline">
                        {p.title[locale]}
                      </Link>
                      <IntlScope namespaces={["compare"]}>
                        <RemoveFromCompare code={p.code} codes={items.map((i) => i.code)} />
                      </IntlScope>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="even:bg-muted/40">
                    <th scope="row" className="p-4 text-left align-top font-medium text-muted-foreground">
                      {r.label}
                    </th>
                    {items.map((p) => (
                      <td key={p.code} className="p-4 align-top">
                        {r.get(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
