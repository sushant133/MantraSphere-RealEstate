import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BlogCard } from "@/components/content/BlogCard";
import { Markdown } from "@/components/content/Markdown";
import { accentBtn } from "@/components/forms/styles";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import { getBlogPost, getRecentPosts, pick } from "@/lib/content";
import { markdownToText, readingMinutes } from "@/lib/markdown";
import { formatDate, localDigits } from "@/lib/properties/format";
import { SITE_URL, absoluteUrl, pageMetadata } from "@/lib/seo";

export const revalidate = 3600;
type Props = { params: Promise<{ locale: Locale; slug: string }> };

const validSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = validSlug(slug) ? await getBlogPost(slug) : null;
  if (!post) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = pick(post.title, locale).text;
  const description = pick(post.excerpt, locale).text || markdownToText(pick(post.body, locale).text);
  const meta = pageMetadata({
    locale,
    path: `/blog/${slug}`,
    title: `${title} | ${t("siteName")}`.length <= 60 ? `${title} | ${t("siteName")}` : title,
    description,
    image: post.cover ? `${SITE_URL}${post.cover.url}` : undefined,
  });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt } };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!validSlug(slug)) notFound();
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const [t, recent] = await Promise.all([getTranslations({ locale, namespace: "blog" }), getRecentPosts(slug)]);
  const title = pick(post.title, locale);
  const body = pick(post.body, locale);
  const minutes = readingMinutes(body.text);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title.text.slice(0, 110),
    description: pick(post.excerpt, locale).text || undefined,
    inLanguage: body.lang === "ne" ? "ne-NP" : "en-NP",
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: absoluteUrl(locale, `/blog/${slug}`),
    image: post.cover ? `${SITE_URL}${post.cover.url}` : `${SITE_URL}/${locale}/opengraph-image`,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    keywords: post.tags.join(", ") || undefined,
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title"), href: "/blog" }, { name: title.text }]} />
      <article className="mx-auto mt-4 max-w-3xl">
        <header>
          <h1 lang={title.lang} className="text-balance text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {title.text}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
            <span aria-hidden="true"> · </span>
            {t("readingTime", { minutes: localDigits(String(minutes), locale) })}
          </p>
          {body.lang !== locale ? <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{t("englishOnly")}</p> : null}
        </header>
        {post.cover ? (
          <Image
            src={post.cover.url}
            alt={post.cover.alt}
            width={post.cover.width}
            height={post.cover.height}
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="mt-6 w-full rounded-2xl object-cover"
          />
        ) : null}
        <Markdown source={body.text} lang={body.lang} className="mt-8 text-[1.0625rem]" />
        {post.tags.length ? (
          <ul aria-label={t("tags")} className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <aside className="mt-10 flex flex-col gap-4 rounded-3xl bg-primary p-6 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{t("cta")}</p>
          <Link href="/properties" className={accentBtn}>
            {t("ctaButton")}
          </Link>
        </aside>
      </article>
      {recent.length ? (
        <section aria-labelledby="more-posts" className="mx-auto mt-14 max-w-5xl">
          <h2 id="more-posts" className="text-xl font-semibold">
            {t("more")}
          </h2>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <li key={p.slug}>
                <BlogCard post={p} locale={locale} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <JsonLd data={jsonLd} />
    </div>
  );
}
