import type { Metadata } from "next";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  Camera,
  GitCompareArrows,
  Home,
  KeyRound,
  LandPlot,
  MapPinned,
  MessagesSquare,
  Ruler,
  ShieldCheck,
  Star,
  UserPlus,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BlogCard } from "@/components/content/BlogCard";
import { HomeSection } from "@/components/home/HomeSection";
import { HeroSearch } from "@/components/search/HeroSearch";
import type { Locale } from "@/lib/constants";
import { getBlogPage } from "@/lib/content";
import { connectDB } from "@/lib/db";
import { localDigits } from "@/lib/properties/format";
import { getDistrictCounts, getHomeSections, getHomeStats, getLocationIndex } from "@/lib/properties/queries";
import { pageMetadata } from "@/lib/seo";
import { Testimonial } from "@/models";

export const revalidate = 60;

const HERO_BLUR =
  "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAADQAQCdASoQAAcAA4BaJZgCdAEfjG1SxAD4Y3e/T81gdiVOvenqHDO2F1XDf8xirBrnzO3bYUawgWydBY13CclIyY66cgoAAAA=";

const getTestimonials = unstable_cache(
  async () => {
    await connectDB();
    const rows = await Testimonial.find({ active: true }).sort({ order: 1 }).limit(3).lean();
    return rows.map((r) => ({ id: String(r._id), name: r.name, role: r.role ?? { en: "", ne: "" }, quote: { en: r.quote?.en ?? "", ne: r.quote?.ne ?? "" }, rating: r.rating }));
  },
  ["testimonials-v1"],
  { tags: ["testimonials"], revalidate: 3600 },
);

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/", title: t("defaultTitle"), description: t("defaultDescription") });
}

const h2 = "text-2xl font-bold tracking-tight text-primary sm:text-3xl";

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tc, sections, districts, locations, testimonials, stats, blog] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "common" }),
    getHomeSections(),
    getDistrictCounts(),
    getLocationIndex(),
    getTestimonials(),
    getHomeStats(),
    getBlogPage(1),
  ]);
  const viewAll = tc("viewAll");
  const rail = { prev: t("railPrev"), next: t("railNext") };
  const n = (v: number) => localDigits(String(v), locale);

  const types = [
    { key: "house", href: "/properties?type=house", count: (stats.byType.HOUSE ?? 0) + (stats.byType.BUNGALOW ?? 0), icon: Home },
    { key: "land", href: "/properties?type=land", count: stats.byType.LAND ?? 0, icon: LandPlot },
    { key: "flat", href: "/properties?type=flat", count: stats.byType.FLAT ?? 0, icon: Building2 },
    { key: "commercial", href: "/properties?type=commercial", count: (stats.byType.COMMERCIAL ?? 0) + (stats.byType.OFFICE ?? 0) + (stats.byType.SHOP ?? 0), icon: Building2 },
    { key: "rent", href: "/properties?purpose=rent", count: stats.forRent, icon: KeyRound },
  ] as const;

  const heroStats = [
    { value: stats.active, label: t("stats.listings") },
    { value: stats.districts, label: t("stats.districts") },
    ...(stats.verifiedOwners ? [{ value: stats.verifiedOwners, label: t("stats.verified") }] : []),
  ].filter((s) => s.value > 0);

  const why = [
    { icon: BadgeCheck, title: t("why.verifiedTitle"), body: t("why.verifiedBody") },
    { icon: Ruler, title: t("why.unitsTitle"), body: t("why.unitsBody") },
    { icon: Star, title: t("why.priceTitle"), body: t("why.priceBody") },
    { icon: MessagesSquare, title: t("why.contactTitle"), body: t("why.contactBody") },
  ];
  const steps = [
    { icon: UserPlus, title: t("how.step1Title"), body: t("how.step1Body") },
    { icon: Camera, title: t("how.step2Title"), body: t("how.step2Body") },
    { icon: ShieldCheck, title: t("how.step3Title"), body: t("how.step3Body") },
  ];
  const tools = [
    { icon: Calculator, href: "/tools/emi-calculator", title: t("tools.emiTitle"), body: t("tools.emiBody") },
    { icon: Ruler, href: "/tools/land-unit-converter", title: t("tools.landTitle"), body: t("tools.landBody") },
    { icon: GitCompareArrows, href: "/compare", title: t("tools.compareTitle"), body: t("tools.compareBody") },
  ];

  return (
    <>
      {/* ---- Hero: full-bleed photo ---- */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-navy-900">
        <Image
          src="/images/hero-home-1600.webp"
          alt=""
          fill
          priority
          fetchPriority="high"
          placeholder="blur"
          blurDataURL={HERO_BLUR}
          // The photo sits behind a dark overlay, so phones get the lighter 800 px file.
          sizes="(max-width: 767px) 40vw, 100vw"
          className="-z-10 object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-900/90 via-navy-900/70 to-navy-900/25" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-navy-900/60 to-transparent" aria-hidden="true" />
        <div className="container-wide flex min-h-[34rem] flex-col justify-center py-14 sm:min-h-[38rem] lg:min-h-[42rem] lg:py-20">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur">
            <BadgeCheck className="size-4 text-saffron" aria-hidden="true" />
            {t("heroBadge")}
          </p>
          <h1 id="hero-title" className="mt-5 max-w-3xl text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-white/85 sm:text-lg">{t("heroSubtitle")}</p>
          <div className="mt-8 max-w-5xl">
            <HeroSearch locale={locale} locations={locations} />
          </div>
          {districts.length ? (
            <nav aria-label={t("popular")} className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-white/80">{t("popular")}:</span>
              {districts.slice(0, 5).map((d) => (
                <Link
                  key={d.slug}
                  href={`/property-for-sale-in-${d.slug}`}
                  className="tap inline-flex items-center rounded-full bg-white/10 px-3.5 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
                >
                  {d[locale]}
                </Link>
              ))}
            </nav>
          ) : null}
          {heroStats.length ? (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/15 pt-6">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <dt className="text-sm text-white/70">{s.label}</dt>
                  <dd className="text-3xl font-bold text-white">{n(s.value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {/* ---- Browse by type ---- */}
      <section aria-labelledby="types-title" className="py-12 sm:py-16">
        <div className="container-wide">
          <h2 id="types-title" className={h2}>
            {t("typesTitle")}
          </h2>
          <p className="mt-1.5 text-muted-foreground">{t("typesSubtitle")}</p>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {types.map(({ key, href, count, icon: Icon }, i) => (
              <li key={key} className={i === 4 ? "col-span-2 sm:col-span-1" : undefined}>
                <Link href={href} className="group relative flex aspect-[4/3] overflow-hidden rounded-2xl bg-muted shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <Image
                    src={`/images/type-${key}-800.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/20 to-transparent" aria-hidden="true" />
                  <span className="relative mt-auto flex w-full items-end justify-between gap-2 p-4 text-white">
                    <span>
                      <span className="flex items-center gap-2 text-lg font-semibold">
                        <Icon className="size-5 text-saffron" aria-hidden="true" />
                        {t(`types.${key}`)}
                      </span>
                      <span className="text-sm text-white/80">{t("typeCount", { count: count, n: n(count) })}</span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HomeSection id="highlight" title={t("highlightTitle")} subtitle={t("highlightSubtitle")} items={sections.highlight} viewAllHref="/properties?tier=highlight" viewAllLabel={viewAll} railLabels={rail} tinted />
      <HomeSection id="top" title={t("topTitle")} subtitle={t("topSubtitle")} items={sections.top} viewAllHref="/properties?tier=top" viewAllLabel={viewAll} railLabels={rail} />
      <HomeSection id="premium" title={t("premiumTitle")} subtitle={t("premiumSubtitle")} items={sections.premium} viewAllHref="/properties?tier=premium" viewAllLabel={viewAll} railLabels={rail} tinted />

      {/* ---- Districts ---- */}
      {districts.length ? (
        <section aria-labelledby="districts-title" className="py-12 sm:py-16">
          <div className="container-wide">
            <h2 id="districts-title" className={h2}>
              {t("districtsTitle")}
            </h2>
            <p className="mt-1.5 text-muted-foreground">{t("districtsSubtitle")}</p>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {districts.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/property-for-sale-in-${d.slug}`}
                    className="group flex h-full items-center gap-3 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)]"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <MapPinned className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{d[locale]}</span>
                      <span className="block text-sm text-muted-foreground">{t("districtCount", { count: d.count, n: n(d.count) })}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <HomeSection id="latest" title={t("latestTitle")} subtitle={t("latestSubtitle")} items={sections.latest} viewAllHref="/properties?tier=latest" viewAllLabel={viewAll} railLabels={rail} tinted />

      {/* ---- Why + how to sell ---- */}
      <section aria-labelledby="why-title" className="py-12 sm:py-16">
        <div className="container-wide grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <h2 id="why-title" className={h2}>
              {t("whyTitle")}
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {why.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-2xl border bg-card p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-saffron/20 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-navy-900 p-6 text-white sm:p-8 lg:col-span-5">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("howTitle")}</h2>
            <ol className="mt-6 space-y-6">
              {steps.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-saffron">
                    <Icon className="size-5" aria-hidden="true" />
                    <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-saffron text-xs font-bold text-saffron-foreground">
                      {n(i + 1)}
                    </span>
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/75">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard/post" className="tap inline-flex items-center rounded-xl bg-saffron px-5 font-semibold text-saffron-foreground hover:bg-saffron/90">
                {t("ctaButton")}
              </Link>
              <Link href="/pricing" className="tap inline-flex items-center rounded-xl border border-white/30 px-5 font-semibold hover:bg-white/10">
                {t("ctaPricing")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Tools + guides ---- */}
      <section aria-labelledby="tools-title" className="bg-navy-50/60 py-12 sm:py-16">
        <div className="container-wide">
          <h2 id="tools-title" className={h2}>
            {t("toolsTitle")}
          </h2>
          <p className="mt-1.5 text-muted-foreground">{t("toolsSubtitle")}</p>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {tools.map(({ icon: Icon, href, title, body }) => (
              <li key={href}>
                <Link href={href} className="group flex h-full gap-4 rounded-2xl border bg-card p-5 transition hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)]">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="flex items-center gap-1.5 font-semibold text-primary">
                      {title}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {blog.items.length ? (
            <>
              <div className="mt-12 flex flex-wrap items-end justify-between gap-3">
                <h3 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">{t("guidesTitle")}</h3>
                <Link href="/blog" className="tap inline-flex items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:underline">
                  {t("allGuides")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {blog.items.slice(0, 3).map((p) => (
                  <li key={p.slug}>
                    <BlogCard post={p} locale={locale} headingLevel={3} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </section>

      <HomeSection id="sold" title={t("soldTitle")} subtitle={t("soldSubtitle")} items={sections.sold} viewAllHref="/properties?status=sold" viewAllLabel={viewAll} railLabels={rail} />

      {testimonials.length ? (
        <section aria-labelledby="testimonials-title" className="bg-navy-50/60 py-12 sm:py-16">
          <div className="container-wide">
            <h2 id="testimonials-title" className={h2}>
              {t("testimonialsTitle")}
            </h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-3">
              {testimonials.map((r) => (
                <li key={r.id}>
                  <figure className="h-full rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
                    <blockquote className="text-pretty leading-relaxed">“{r.quote[locale] || r.quote.en}”</blockquote>
                    <figcaption className="mt-4 text-sm">
                      <span className="font-semibold">{r.name}</span>
                      {r.role[locale] ? <span className="text-muted-foreground"> · {r.role[locale]}</span> : null}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ---- CTA band ---- */}
      <section aria-labelledby="cta-title" className="relative isolate -mb-16 overflow-hidden bg-navy-900">
        <Image src="/images/cta-band-1600.webp" alt="" fill sizes="(max-width: 767px) 50vw, 100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-900/95 via-navy-900/80 to-navy-900/40" aria-hidden="true" />
        <div className="container-wide flex flex-col items-start gap-6 py-14 text-white sm:py-20 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 id="cta-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("ctaTitle")}
            </h2>
            <p className="mt-3 text-lg text-white/85">{t("ctaBody")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/post" className="tap inline-flex items-center rounded-xl bg-saffron px-6 font-semibold text-saffron-foreground hover:bg-saffron/90">
              {t("ctaButton")}
            </Link>
            <Link href="/pricing" className="tap inline-flex items-center rounded-xl border border-white/40 px-6 font-semibold hover:bg-white/10">
              {t("ctaPricing")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
