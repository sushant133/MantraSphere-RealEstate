import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "404 – Page not found | पृष्ठ फेला परेन" },
  robots: { index: false, follow: true },
};

/** Localised 404 (fix #6). Rendered with a real 404 status by notFound(). */
export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-price">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("description")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild className="tap">
          <Link href="/">{t("backHome")}</Link>
        </Button>
        <Button asChild variant="outline" className="tap">
          <Link href="/properties">{t("searchProperties")}</Link>
        </Button>
      </div>
    </div>
  );
}
