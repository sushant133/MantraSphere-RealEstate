import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ListingResults } from "@/components/search/ListingResults";
import type { Locale } from "@/lib/constants";
import { landingSlug, parseFilters, parseLandingSlug, type Filters, type Landing } from "@/lib/properties/filters";
import { getLandingCombos, getLocationIndex, resolveLocation, searchProperties } from "@/lib/properties/queries";
import { listingTexts } from "@/lib/properties/texts";
import { pageMetadata } from "@/lib/seo";

/**
 * Catch-all: SEO landing pages for type × purpose × district
 * (`/en/land-for-sale-in-bhaktapur`, fix #10); every other unknown URL is a 404.
 */

type Props = { params: Promise<{ locale: Locale; rest: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOT_FOUND_META: Metadata = {
  title: { absolute: "404 – Page not found | पृष्ठ फेला परेन" },
  robots: { index: false, follow: true },
};

async function load(rest: string[], page: string | string[] | undefined) {
  if (rest.length !== 1) return null;
  const landing = parseLandingSlug(rest[0]);
  if (!landing) return null;
  const f = parseFilters({ purpose: landing.purpose, type: landing.type, district: landing.district, page: typeof page === "string" ? page : undefined });
  const { names } = await resolveLocation(f);
  if (landing.district && !names.district) return null;
  return { landing, f, names };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, rest } = await params;
  const data = await load(rest, (await searchParams).page);
  if (!data) return NOT_FOUND_META;
  const result = await searchProperties(data.f);
  const texts = await listingTexts(locale, data.f, data.names, result.total);
  const t = await getTranslations({ locale, namespace: "meta" });
  const withBrand = `${texts.title} | ${t("siteName")}`;
  return pageMetadata({
    locale,
    path: `/${rest[0]}${data.f.page > 1 ? `?page=${data.f.page}` : ""}`,
    title: withBrand.length <= 60 ? withBrand : texts.title,
    description: texts.description,
    noindex: result.total === 0,
  });
}

export default async function CatchAll({ params, searchParams }: Props) {
  const { locale, rest } = await params;
  setRequestLocale(locale);
  const data = await load(rest, (await searchParams).page);
  if (!data) notFound();
  const { landing, f, names } = data;

  const [locations, result, combos] = await Promise.all([getLocationIndex(), searchProperties(f), getLandingCombos()]);
  if (f.page > result.pages) notFound();
  const texts = await listingTexts(locale, f, names, result.total);
  const t = await getTranslations({ locale, namespace: "landing" });
  const ts = await getTranslations({ locale, namespace: "search" });
  const td = await getTranslations({ locale, namespace: "detail" });

  const what =
    locale === "en"
      ? `${texts.type.toLowerCase()} for ${texts.purpose.toLowerCase()}`
      : `${texts.purpose} ${texts.type}`;
  const intro = t("intro", { count: result.total, what, place: texts.place });

  // Related: other types in this district, and this type in other districts.
  const related = combos
    .filter((c) => c.slug !== rest[0] && c.purpose === landing.purpose && (c.district === landing.district || (c.type === landing.type && c.district)))
    .slice(0, 12);
  const label = async (c: Landing) => {
    const lf = parseFilters({ purpose: c.purpose, type: c.type, district: c.district });
    const { names: n } = await resolveLocation(lf);
    return (await listingTexts(locale, lf as Filters, n, 0)).heading;
  };
  const relatedLinks = await Promise.all(related.map(async (c) => ({ href: `/${landingSlug(c)}`, text: await label(c), count: c.count })));

  return (
    <ListingResults
      locale={locale}
      f={f}
      result={result}
      names={names}
      locations={locations}
      heading={texts.heading}
      intro={intro}
      crumbs={[
        { name: td("properties"), href: "/properties" },
        ...(landing.district && names.district
          ? [{ name: ts("headingPurpose", { type: ts(`typePlural.ALL`), purpose: texts.purpose, place: names.district[locale] }), href: `/${landingSlug({ purpose: landing.purpose, district: landing.district })}` }]
          : []),
        { name: texts.heading },
      ].filter((c, i, arr) => i === arr.length - 1 || c.href !== `/${rest[0]}`)}
      pageHref={(page) => `/${rest[0]}${page > 1 ? `?page=${page}` : ""}`}
      after={
        relatedLinks.length ? (
          <section aria-labelledby="related-searches" className="mt-14 border-t pt-8">
            <h2 id="related-searches" className="text-lg font-semibold text-primary">
              {t("related")}
            </h2>
            <ul className="mt-4 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="tap inline-flex items-center text-sm text-foreground/85 hover:text-primary hover:underline">
                    {l.text} ({l.count})
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      }
    />
  );
}

