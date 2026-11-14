"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LABEL: Record<Locale, { short: string; full: string; lang: string }> = {
  en: { short: "EN", full: "English", lang: "en" },
  ne: { short: "ने", full: "नेपाली", lang: "ne" },
};

/** EN / ने toggle that keeps the current path and query string. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = search ? `${pathname}?${search}` : pathname;

  return (
    <nav aria-label={t("language")} className={cn("flex items-center rounded-full bg-muted p-1", className)}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={href}
          locale={l}
          lang={LABEL[l].lang}
          hrefLang={LABEL[l].lang}
          aria-current={l === current ? "true" : undefined}
          aria-label={LABEL[l].full}
          className={cn(
            "tap inline-flex items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors",
            l === current ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABEL[l].short}
        </Link>
      ))}
    </nav>
  );
}
