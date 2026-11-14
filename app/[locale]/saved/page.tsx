import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { SavedList } from "./SavedList";
import { IntlScope } from "@/components/IntlScope";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "saved" });
  return pageMetadata({ locale, path: "/saved", title: t("title"), description: t("description"), noindex: true });
}

export default async function SavedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "saved" });
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("deviceNote")}</p>
      <div className="mt-6">
        <IntlScope namespaces={["common", "property", "saved"]}>
          <SavedList />
        </IntlScope>
      </div>
    </div>
  );
}
