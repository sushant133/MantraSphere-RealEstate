import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import { formatDate } from "@/lib/properties/format";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site";
import { EmiCalculator } from "./EmiCalculator";

export const revalidate = 3600;
type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tools.emi" });
  return pageMetadata({ locale, path: "/tools/emi-calculator", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function EmiPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, s] = await Promise.all([getTranslations({ locale, namespace: "tools.emi" }), getSiteSettings()]);
  const rates = (s.loanRates ?? [])
    .filter((r) => r.bank && r.ratePct > 0)
    .sort((a, b) => a.ratePct - b.ratePct)
    .map((r) => ({ bank: r.bank, ratePct: r.ratePct, updated: r.updatedAt ? formatDate(new Date(r.updatedAt).toISOString(), locale) : "" }));
  // Start from the median published rate; 10% is only an editable starting value.
  const defaultRate = rates.length ? rates[Math.floor(rates.length / 2)].ratePct : 10;

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title") }]} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("intro")}</p>
      </header>
      <div className="mt-8">
        <IntlScope namespaces={["tools"]}>
          <EmiCalculator locale={locale} rates={rates} defaultRate={defaultRate} />
        </IntlScope>
      </div>
      <section className="md mt-12 max-w-3xl">
        <h2>{t("howTitle")}</h2>
        <p>{t("how1")}</p>
        <p>
          <code>EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)</code>
        </p>
        <p>{t("how2")}</p>
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: t("title"),
          url: absoluteUrl(locale, "/tools/emi-calculator"),
          applicationCategory: "FinanceApplication",
          operatingSystem: "Any",
          isAccessibleForFree: true,
        }}
      />
    </div>
  );
}
