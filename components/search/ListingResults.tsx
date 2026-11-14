import type { ReactNode } from "react";
import { BellPlus, LayoutGrid, List, Map as MapIcon, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PropertyCard } from "@/components/property/PropertyCard";
import { Breadcrumbs, type Crumb } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import {
  activeFilterCount,
  filtersToQuery,
  PAGE_SIZE,
  SORTS,
  VIEWS,
  type Filters,
} from "@/lib/properties/filters";
import type {
  LocationIndex,
  ResolvedNames,
  SearchResult,
} from "@/lib/properties/queries";
import { localDigits } from "@/lib/properties/format";
import { cn } from "@/lib/utils";
import { IntlScope } from "@/components/IntlScope";
import { FilterForm, FILTER_FORM_ID } from "./FilterForm";
import { FiltersPanel, FiltersProvider, FilterToggle } from "./FiltersShell";
import { InfiniteList } from "./InfiniteList";
import { MapView } from "./MapView";
import { Pagination } from "./Pagination";

const GRID = "grid gap-5 sm:grid-cols-2 xl:grid-cols-3";
const LIST = "grid gap-4";

/** Shared layout for /properties and SEO landing pages: H1, filters, toolbar, results. */
export async function ListingResults({
  locale,
  f,
  result,
  names,
  locations,
  heading,
  intro,
  crumbs,
  pageHref,
  after,
}: {
  locale: Locale;
  f: Filters;
  result: SearchResult;
  names: ResolvedNames;
  locations: LocationIndex;
  heading: string;
  intro?: string;
  crumbs: Crumb[];
  pageHref: (page: number) => string;
  after?: ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "search" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const query = filtersToQuery(f, { page: 1 });
  const viewIcons = { grid: LayoutGrid, list: List, map: MapIcon } as const;
  const from = (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.total, from + result.items.length - 1);
  const isMap = f.view === "map";
  const variant = f.view === "list" ? "list" : "grid";

  return (
    <IntlScope namespaces={["common", "property", "search"]}>
      <FiltersProvider>
        <div className="container-page py-6 lg:py-8">
          <Breadcrumbs locale={locale} items={crumbs} />
          <header className="mt-3 max-w-3xl">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {heading}
            </h1>
            {intro ? (
              <p className="mt-2 text-pretty text-muted-foreground">{intro}</p>
            ) : null}
          </header>

          <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
            <aside className="lg:col-span-4 xl:col-span-3">
              <FiltersPanel
                formId={FILTER_FORM_ID}
                title={t("filters")}
                closeLabel={t("close")}
                showResultsLabel={t("showResults")}
              >
                <FilterForm
                  locale={locale}
                  f={f}
                  locations={locations}
                  names={names}
                />
              </FiltersPanel>
            </aside>

            <section
              className="min-w-0 lg:col-span-8 xl:col-span-9"
              aria-labelledby="results-count"
            >
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <p
                  id="results-count"
                  className="mr-auto text-sm font-medium text-muted-foreground"
                  aria-live="polite"
                >
                  {result.total > 0 && !isMap
                    ? t("showing", {
                        from: localDigits(String(from), locale),
                        to: localDigits(String(to), locale),
                        total: localDigits(String(result.total), locale),
                      })
                    : t("results", { count: result.total })}
                </p>
                <FilterToggle
                  label={t("filters")}
                  count={activeFilterCount(f)}
                />
                {f.status !== "sold" ? (
                  <Link
                    href={`/dashboard/searches?save=${encodeURIComponent(query)}`}
                    rel="nofollow"
                    className="tap inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm font-medium hover:bg-muted"
                  >
                    <BellPlus className="size-4" aria-hidden="true" />
                    <span>{t("saveSearch")}</span>
                  </Link>
                ) : null}
                <div className="flex items-center gap-2">
                  <label htmlFor="sort" className="sr-only">
                    {t("sortBy")}
                  </label>
                  <select
                    id="sort"
                    name="sort"
                    form={FILTER_FORM_ID}
                    defaultValue={f.sort}
                    className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {SORTS.map((s) => (
                      <option key={s} value={s}>
                        {t(`sort.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <nav
                  aria-label={t("view")}
                  className="flex rounded-xl border p-0.5"
                >
                  {VIEWS.map((v) => {
                    const Icon = viewIcons[v];
                    const qs = filtersToQuery(f, { view: v, page: 1 });
                    return (
                      <Link
                        key={v}
                        href={`/properties${qs ? `?${qs}` : ""}`}
                        aria-current={f.view === v ? "true" : undefined}
                        className={cn(
                          "tap inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium",
                          f.view === v
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        <span className="max-sm:sr-only">
                          {t(`views.${v}`)}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {isMap ? (
                <MapView
                  query={query}
                  locale={locale}
                  labels={{
                    loading: t("mapLoading"),
                    truncated: t("mapTruncated"),
                    empty: t("mapEmpty"),
                    mapLabel: t("mapLabel"),
                    priceOnRequest: tc("priceOnRequest"),
                  }}
                />
              ) : result.items.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
                  <SearchX
                    className="size-10 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <h2 className="mt-4 text-lg font-semibold">
                    {t("noResultsTitle")}
                  </h2>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {t("noResultsHint")}
                  </p>
                  <Link
                    href="/properties"
                    className="tap mt-6 inline-flex items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
                  >
                    {t("clearFilters")}
                  </Link>
                </div>
              ) : (
                <>
                  <ul className={variant === "list" ? LIST : GRID}>
                    {result.items.map((p, i) => (
                      <li key={p.id} className="flex">
                        <PropertyCard
                          p={p}
                          variant={variant}
                          priority={i < 2}
                          headingLevel={2}
                        />
                      </li>
                    ))}
                  </ul>
                  <InfiniteList
                    query={query}
                    page={result.page}
                    pages={result.pages}
                    cursor={result.nextCursor}
                    variant={variant}
                    gridClassName={variant === "list" ? LIST : GRID}
                  />
                  <Pagination
                    locale={locale}
                    page={result.page}
                    pages={result.pages}
                    href={pageHref}
                  />
                </>
              )}
            </section>
          </div>
          {after}
        </div>
      </FiltersProvider>
    </IntlScope>
  );
}
