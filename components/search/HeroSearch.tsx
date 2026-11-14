import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/constants";
import type { LocationIndex } from "@/lib/properties/queries";
import { TYPE_SLUGS } from "@/lib/properties/filters";
import { getPathname } from "@/i18n/navigation";

/**
 * Hero search: a plain GET form (no JavaScript needed) so every search has a
 * real, shareable URL. The tab is mapped to purpose/type by the
 * /properties page, which then redirects to the canonical query string.
 */
export async function HeroSearch({ locale, locations }: { locale: Locale; locations: LocationIndex }) {
  const t = await getTranslations({ locale, namespace: "search" });
  const action = getPathname({ href: "/properties", locale });
  const tabs = ["buy", "rent", "land", "commercial"] as const;

  return (
    <form action={action} method="get" role="search" aria-label={t("submit")} className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card-hover)] sm:p-4">
      <fieldset className="min-w-0">
        <legend className="sr-only">{t("searchType")}</legend>
        <div className="mb-3 flex gap-1 overflow-x-auto">
          {tabs.map((tab, i) => (
            <label key={tab} className="relative">
              <input type="radio" name="tab" value={tab} defaultChecked={i === 0} className="peer sr-only" />
              <span className="tap inline-flex cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:text-foreground peer-checked:hover:text-primary-foreground">
                {t(`tabs.${tab}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <label htmlFor="hero-q" className="sr-only">
            {t("keyword")}
          </label>
          <input
            id="hero-q"
            name="q"
            type="search"
            maxLength={100}
            autoComplete="off"
            placeholder={t("keywordPlaceholder")}
            className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="hero-district" className="sr-only">
            {t("district")}
          </label>
          <select id="hero-district" name="district" defaultValue="" className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base">
            <option value="">{t("anyDistrict")}</option>
            {locations.provinces.map((p) => (
              <optgroup key={p.id} label={p[locale]}>
                {locations.districts
                  .filter((d) => d.provinceId === p.id)
                  .map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d[locale]}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="hero-type" className="sr-only">
            {t("type")}
          </label>
          <select id="hero-type" name="type" defaultValue="" className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base">
            <option value="">{t("anyType")}</option>
            {(Object.keys(TYPE_SLUGS) as (keyof typeof TYPE_SLUGS)[]).map((k) => (
              <option key={k} value={k}>
                {t(`typePlural.${TYPE_SLUGS[k]}`)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="tap inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-saffron px-5 text-base font-semibold text-saffron-foreground transition-colors hover:bg-saffron/90 sm:col-span-2"
        >
          <Search className="size-5" aria-hidden="true" />
          {t("submit")}
        </button>
      </div>
    </form>
  );
}
