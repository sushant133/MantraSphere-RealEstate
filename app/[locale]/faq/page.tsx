import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import { getAllFaqs, pick } from "@/lib/content";
import { markdownToText } from "@/lib/markdown";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;
type Props = { params: Promise<{ locale: Locale }> };
const ORDER = ["GENERAL", "LISTING", "PRICING", "PAYMENT"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.faq" });
  return pageMetadata({ locale, path: "/faq", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, faqs] = await Promise.all([getTranslations({ locale, namespace: "pages.faq" }), getAllFaqs()]);
  const groups = ORDER.map((c) => ({ c, items: faqs.filter((f) => f.category === c) })).filter((g) => g.items.length);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale === "ne" ? "ne-NP" : "en-NP",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: pick(f.q, locale).text,
      acceptedAnswer: { "@type": "Answer", text: markdownToText(pick(f.a, locale).text) },
    })),
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title") }]} />
      <div className="mx-auto mt-4 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("intro")}</p>
        {groups.length > 1 ? (
          <nav aria-label={t("jump")} className="mt-6 flex flex-wrap gap-2">
            {groups.map((g) => (
              <a key={g.c} href={`#faq-${g.c.toLowerCase()}`} className="tap inline-flex items-center rounded-full border px-4 text-sm font-medium hover:bg-muted">
                {t(`categories.${g.c}`)}
              </a>
            ))}
          </nav>
        ) : null}
        {groups.map((g) => (
          <section key={g.c} aria-labelledby={`faq-${g.c.toLowerCase()}`} className="mt-10">
            <h2 id={`faq-${g.c.toLowerCase()}`} className="scroll-mt-24 text-xl font-semibold text-primary">
              {t(`categories.${g.c}`)}
            </h2>
            <div className="mt-3 divide-y rounded-2xl border bg-card">
              {g.items.map((f) => {
                const q = pick(f.q, locale);
                const a = pick(f.a, locale);
                return (
                  <details key={f.id} className="group px-5">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                      <span lang={q.lang}>{q.text}</span>
                      <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p lang={a.lang} className="whitespace-pre-line pb-5 text-muted-foreground">
                      {a.text}
                    </p>
                  </details>
                );
              })}
            </div>
          </section>
        ))}
        <p className="mt-10 rounded-2xl bg-muted p-5">
          {t("stillQuestions")}{" "}
          <Link href="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t("contactUs")}
          </Link>
        </p>
      </div>
      {faqs.length ? <JsonLd data={jsonLd} /> : null}
    </div>
  );
}
