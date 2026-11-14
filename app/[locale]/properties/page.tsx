import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { ListingResults } from "@/components/search/ListingResults";
import type { Locale } from "@/lib/constants";
import { filtersSchema, filtersToQuery, landingFor, landingSlug, parseFilters, type Filters } from "@/lib/properties/filters";
import { getLocationIndex, resolveLocation, searchProperties } from "@/lib/properties/queries";
import { listingTexts } from "@/lib/properties/texts";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const TAB_MAP: Record<string, Partial<Record<keyof Filters, string>>> = {
  buy: { purpose: "sale" },
  rent: { purpose: "rent" },
  land: { type: "land" },
  commercial: { type: "commercial" },
};

/** Canonical URL for a filter set: its landing page, plain /properties, or itself (noindex). */
function canonicalFor(f: Filters): { path: string; index: boolean } {
  const pageQs = f.page > 1 ? `?page=${f.page}` : "";
  const landing = landingFor(f);
  if (landing) return { path: `/${landingSlug(landing)}${pageQs}`, index: true };
  const qs = filtersToQuery(f);
  if (!qs || qs === `page=${f.page}`) return { path: `/properties${pageQs}`, index: true };
  return { path: `/properties?${qs}`, index: false };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const f = parseFilters(await searchParams);
  const [{ names }, result] = await Promise.all([resolveLocation(f), searchProperties(f)]);
  const texts = await listingTexts(locale, f, names, result.total);
  const c = canonicalFor(f);
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = `${texts.title} | ${t("siteName")}`.length <= 60 ? `${texts.title} | ${t("siteName")}` : texts.title;
  return pageMetadata({
    locale,
    path: c.path,
    title,
    description: texts.description,
    noindex: !c.index || result.total === 0,
  });
}

export default async function PropertiesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = await searchParams;

  // Hero tabs → filters, then normalise to one canonical query string.
  const tab = typeof raw.tab === "string" ? TAB_MAP[raw.tab] : undefined;
  const merged: Record<string, string | string[] | undefined> = { ...raw };
  delete merged.tab;
  if (tab) for (const [k, v] of Object.entries(tab)) if (!merged[k]) merged[k] = v;
  const f = parseFilters(merged);
  const canonicalQs = filtersToQuery(f);
  const known = new Set(Object.keys(filtersSchema.shape));
  const rawQs = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])) as [string, string][],
  );
  const isCanonical =
    !("tab" in raw) &&
    [...rawQs.keys()].every((k) => known.has(k)) &&
    new URLSearchParams(canonicalQs).toString() === new URLSearchParams([...rawQs].filter(([, v]) => v !== "")).toString() &&
    [...rawQs.values()].every((v) => v !== "");
  if (!isCanonical) {
    const path = getPathname({ href: "/properties", locale });
    redirect(`${path}${canonicalQs ? `?${canonicalQs}` : ""}`);
  }

  const [{ names }, locations, result] = await Promise.all([resolveLocation(f), getLocationIndex(), searchProperties(f)]);
  const texts = await listingTexts(locale, f, names, result.total);
  const td = await getTranslations({ locale, namespace: "detail" });

  return (
    <ListingResults
      locale={locale}
      f={f}
      result={result}
      names={names}
      locations={locations}
      heading={texts.heading}
      crumbs={canonicalQs ? [{ name: td("properties"), href: "/properties" }, { name: texts.heading }] : [{ name: td("properties") }]}
      pageHref={(page) => {
        const qs = filtersToQuery(f, { page });
        return `/properties${qs ? `?${qs}` : ""}`;
      }}
    />
  );
}
