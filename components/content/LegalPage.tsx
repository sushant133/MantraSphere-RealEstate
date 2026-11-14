import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import { getStaticPage, pick } from "@/lib/content";
import { markdownToText } from "@/lib/markdown";
import { formatDate } from "@/lib/properties/format";
import { pageMetadata } from "@/lib/seo";
import { Markdown } from "./Markdown";

/** Privacy policy and terms: admin-editable Markdown (Admin → Content → Legal pages). */
export async function legalMetadata(locale: Locale, slug: "privacy" | "terms"): Promise<Metadata> {
  const p = await getStaticPage(slug);
  if (!p) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = pick(p.title, locale).text;
  const description = pick(p.summary, locale).text || markdownToText(pick(p.body, locale).text);
  return pageMetadata({ locale, path: `/${slug}`, title: `${title} | ${t("siteName")}`, description });
}

export async function LegalPageView({ locale, slug }: { locale: Locale; slug: "privacy" | "terms" }) {
  const p = await getStaticPage(slug);
  if (!p) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });
  const title = pick(p.title, locale);
  const body = pick(p.body, locale);
  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: title.text }]} />
      <article className="mx-auto mt-4 max-w-3xl">
        <h1 lang={title.lang} className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          {title.text}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("lastUpdated", { date: formatDate(p.updatedAt, locale) })}</p>
        {body.lang !== locale ? <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{t("englishOnly")}</p> : null}
        <Markdown source={body.text} lang={body.lang} className="mt-8" />
      </article>
    </div>
  );
}
