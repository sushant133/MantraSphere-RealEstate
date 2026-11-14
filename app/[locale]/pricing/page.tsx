import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Check, Minus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/JsonLd";
import { accentBtn, outlineBtn } from "@/components/forms/styles";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { formatPriceFull, toDevanagariDigits } from "@/lib/price";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { Faq, Plan } from "@/models";

export const revalidate = 3600;

const getPlans = unstable_cache(
  async () => {
    await connectDB();
    const rows = await Plan.find({ active: true }).sort({ sortWeight: 1 }).lean();
    return rows.map((p) => ({
      slug: p.slug,
      tier: p.tier,
      name: { en: p.name?.en ?? p.slug, ne: p.name?.ne || p.name?.en || p.slug },
      priceNpr: p.priceNpr,
      durationDays: p.durationDays ?? null,
      homepageSection: p.homepageSection ?? null,
      facebookPromotionDays: p.facebookPromotionDays ?? 0,
      videoIncluded: !!p.videoIncluded,
      maxPhotos: p.maxPhotos ?? 10,
      features: { en: p.features?.en ?? [], ne: p.features?.ne ?? [] },
    }));
  },
  ["pricing-plans-v1"],
  { tags: ["plans"], revalidate: 3600 },
);

const getFaqs = unstable_cache(
  async () => {
    await connectDB();
    const rows = await Faq.find({ active: true, category: trusted({ $in: ["PRICING", "PAYMENT"] }) }).sort({ order: 1 }).lean();
    return rows.map((f) => ({ id: String(f._id), q: { en: f.question?.en ?? "", ne: f.question?.ne || f.question?.en || "" }, a: { en: f.answer?.en ?? "", ne: f.answer?.ne || f.answer?.en || "" } }));
  },
  ["pricing-faqs-v1"],
  { tags: ["faqs"], revalidate: 3600 },
);

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return pageMetadata({ locale, path: "/pricing", title: `${t("title")} | ${locale === "ne" ? "मन्त्रास्फियर" : "MantraSphere"}`, description: t("metaDescription") });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tw, plans, faqs] = await Promise.all([getTranslations({ locale, namespace: "pricing" }), getTranslations({ locale, namespace: "wizard" }), getPlans(), getFaqs()]);
  const n = (v: number) => (locale === "ne" ? toDevanagariDigits(String(v)) : String(v));
  const popular = plans.find((p) => p.tier === "TOP")?.slug ?? plans[Math.floor(plans.length / 2)]?.slug;
  const yes = (on: boolean) =>
    on ? (
      <>
        <Check className="mx-auto size-5 text-success" aria-hidden="true" />
        <span className="sr-only">{t("included")}</span>
      </>
    ) : (
      <>
        <Minus className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t("notIncluded")}</span>
      </>
    );

  return (
    <div className="container-page py-10 lg:py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("intro")}</p>
      </header>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((p) => (
          <li key={p.slug} className={cn("relative flex flex-col rounded-3xl border bg-card p-6", p.slug === popular && "border-primary ring-2 ring-primary")}>
            {p.slug === popular ? (
              <span className="absolute -top-3 left-6 rounded-full bg-saffron px-3 py-0.5 text-xs font-bold text-saffron-foreground">{t("mostPopular")}</span>
            ) : null}
            <h2 className="text-xl font-bold text-primary">{p.name[locale]}</h2>
            <p className="mt-2 text-2xl font-bold text-price">{formatPriceFull(p.priceNpr, locale)}</p>
            <p className="text-sm text-muted-foreground">{p.durationDays ? tw("days", { count: n(p.durationDays) }) : tw("untilSold")}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features[locale].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href={`/dashboard/post?plan=${p.slug}`} className={cn(p.slug === popular ? accentBtn : outlineBtn, "mt-6 w-full")}>
              {t("choose", { plan: p.name[locale] })}
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="compare" className="mt-16">
        <h2 id="compare" className="text-2xl font-bold text-primary">
          {t("compare")}
        </h2>
        <div className="mt-5 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">{t("compare")}</caption>
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  {t("feature")}
                </th>
                {plans.map((p) => (
                  <th key={p.slug} scope="col" className="px-4 py-3 text-center">
                    {p.name[locale]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">{t("rows.duration")}</th>
                {plans.map((p) => (
                  <td key={p.slug} className="px-4 py-3 text-center">{p.durationDays ? tw("days", { count: n(p.durationDays) }) : tw("untilSold")}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">{t("rows.placement")}</th>
                {plans.map((p) => (
                  <td key={p.slug} className="px-4 py-3 text-center">{p.homepageSection ? t("section", { name: p.name[locale] }) : t("listingPages")}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">{t("rows.photos")}</th>
                {plans.map((p) => (
                  <td key={p.slug} className="px-4 py-3 text-center">{n(p.maxPhotos)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">{t("rows.facebook")}</th>
                {plans.map((p) => (
                  <td key={p.slug} className="px-4 py-3 text-center">{p.facebookPromotionDays ? tw("days", { count: n(p.facebookPromotionDays) }) : yes(false)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">{t("rows.badge")}</th>
                {plans.map((p) => (
                  <td key={p.slug} className="px-4 py-3 text-center">{yes(p.tier !== "NORMAL")}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">{t("rows.video")}</th>
                {plans.map((p) => (
                  <td key={p.slug} className="px-4 py-3 text-center">{yes(p.videoIncluded)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {faqs.length ? (
        <section aria-labelledby="pricing-faq" className="mt-16 max-w-3xl">
          <h2 id="pricing-faq" className="text-2xl font-bold text-primary">
            {t("faqTitle")}
          </h2>
          <div className="mt-5 divide-y rounded-2xl border bg-card">
            {faqs.map((f) => (
              <details key={f.id} className="group p-5">
                <summary className="tap flex cursor-pointer items-center font-semibold">{f.q[locale]}</summary>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{f.a[locale]}</p>
              </details>
            ))}
          </div>
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q[locale], acceptedAnswer: { "@type": "Answer", text: f.a[locale] } })),
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
