import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BlogCard } from "@/components/content/BlogCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Pagination } from "@/components/search/Pagination";
import type { Locale } from "@/lib/constants";
import { getBlogPage } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;
type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ page?: string }> };

const pageOf = (v?: string) => {
  const n = Number(v ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const page = pageOf((await searchParams).page);
  const t = await getTranslations({ locale, namespace: "blog" });
  const { total } = await getBlogPage(page);
  return pageMetadata({
    locale,
    path: page > 1 ? `/blog?page=${page}` : "/blog",
    title: page > 1 ? t("metaTitlePaged", { page }) : t("metaTitle"),
    description: t("metaDescription"),
    noindex: total === 0,
  });
}

export default async function BlogIndex({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = pageOf((await searchParams).page);
  const [t, data] = await Promise.all([getTranslations({ locale, namespace: "blog" }), getBlogPage(page)]);
  if (page > data.pages) notFound();

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title") }]} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("intro")}</p>
      </header>
      {data.items.length ? (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <li key={p.slug}>
              <BlogCard post={p} locale={locale} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{t("empty")}</p>
      )}
      <Pagination locale={locale} page={page} pages={data.pages} href={(n) => (n > 1 ? `/blog?page=${n}` : "/blog")} />
    </div>
  );
}
