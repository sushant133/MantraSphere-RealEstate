import "server-only";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/constants";
import { TIER_SLUGS, TYPE_SLUGS, type Filters } from "./filters";
import type { ResolvedNames } from "./queries";
import { localDigits } from "./format";

/** H1, <title> and meta description for listing/landing pages, built from the filters (fix #1). */
export async function listingTexts(locale: Locale, f: Filters, names: ResolvedNames, total: number) {
  const t = await getTranslations({ locale, namespace: "search" });
  const tp = await getTranslations({ locale, namespace: "property" });
  const type = t(`typePlural.${f.type ? TYPE_SLUGS[f.type] : "ALL"}`);
  const place =
    names.municipality && names.district
      ? `${names.municipality[locale]}, ${names.district[locale]}`
      : (names.district?.[locale] ?? names.province?.[locale] ?? t("nepal"));
  const purpose = f.purpose ? t(`purposeWord.${f.purpose}`) : "";
  const lower = (s: string) => (locale === "en" ? s.toLowerCase() : s);

  let heading: string;
  if (f.status === "sold") heading = t("headingSold");
  else if (f.tier) heading = t("headingTier", { tier: tp(`tier.${TIER_SLUGS[f.tier]}`) });
  else if (f.purpose) heading = t("headingPurpose", { type, purpose, place });
  else heading = t("headingNoPurpose", { type, place });

  const count = localDigits(String(total), locale);
  const description = f.purpose
    ? t("metaDescription", { count, type: lower(type), purpose: lower(purpose), place })
    : t("metaDescriptionAll", { count });

  const pageSuffix = f.page > 1 ? ` – ${t("pageN", { page: localDigits(String(f.page), locale) })}` : "";
  const query = f.q ? ` – ${t("resultsFor", { q: f.q })}` : "";
  return { heading: `${heading}${query}`, title: `${heading}${pageSuffix}`, description, place, type, purpose };
}
