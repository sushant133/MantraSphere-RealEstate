import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import { formatNumber } from "@/lib/price";
import { pageMetadata } from "@/lib/seo";
import { SQFT } from "@/lib/units";
import { LandConverter } from "./LandConverter";

export const revalidate = 86400;
type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tools.land" });
  return pageMetadata({ locale, path: "/tools/land-unit-converter", title: t("metaTitle"), description: t("metaDescription") });
}

const REFERENCE = [
  ["ROPANI", "16 AANA", SQFT.ROPANI],
  ["AANA", "4 PAISA", SQFT.AANA],
  ["PAISA", "4 DAAM", SQFT.PAISA],
  ["DAAM", "", SQFT.DAAM],
  ["BIGHA", "20 KATTHA", SQFT.BIGHA],
  ["KATTHA", "20 DHUR", SQFT.KATTHA],
  ["DHUR", "", SQFT.DHUR],
  ["SQM", "", SQFT.SQM],
] as const;

export default async function LandConverterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tools.land" });
  const fmt = (n: number) => formatNumber(n, locale, 4);
  const unitName = (u: string) => t(`units.${u as "ROPANI"}`);

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title") }]} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("intro")}</p>
      </header>
      <div className="mt-8">
        <IntlScope namespaces={["tools"]}>
          <LandConverter locale={locale} />
        </IntlScope>
      </div>
      <section aria-labelledby="ref-title" className="mt-12 max-w-3xl">
        <h2 id="ref-title" className="text-xl font-semibold text-primary">
          {t("referenceTitle")}
        </h2>
        <p className="mt-2 text-muted-foreground">{t("referenceIntro")}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] rounded-2xl border bg-card text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("unit")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("equals")}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {t("inSqft")}
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {REFERENCE.map(([u, eq, sq]) => (
                <tr key={u} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {unitName(u)}
                  </th>
                  <td className="px-4 py-3">{eq ? `${fmt(Number(eq.split(" ")[0]))} ${unitName(eq.split(" ")[1])}` : "—"}</td>
                  <td className="px-4 py-3 text-right">{fmt(sq)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("note")}</p>
      </section>
    </div>
  );
}
