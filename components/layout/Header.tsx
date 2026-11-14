import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/constants";
import { HeaderShell } from "./HeaderShell";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";
import { AccountButton } from "./AccountButton";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav-items";

export async function Header({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale });
  const siteName = t("meta.siteName");
  const [primary, ...rest] = locale === "ne" ? ["मन्त्रास्फियर", "रियल इस्टेट"] : ["MantraSphere", "Real Estate"];

  return (
    <HeaderShell>
      <Link href="/" className="tap -ml-1 flex items-center rounded-lg px-1">
        <Logo name={{ primary, secondary: rest.join(" ") }} latin={locale === "en"} />
      </Link>

      <nav aria-label={t("a11y.mainNav")} className="ml-4 hidden lg:block xl:ml-8">
        <ul className="flex items-center gap-0.5 xl:gap-1">
          {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item, i) => (
            <li key={item.key} className={i >= PRIMARY_NAV.length ? "hidden xl:block" : undefined}>
              <Link
                href={item.href}
                className="tap inline-flex items-center rounded-lg px-2.5 text-[0.9375rem] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground xl:px-3"
              >
                {t(`nav.${item.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Suspense fallback={<div className="hidden h-11 w-[5.5rem] sm:block" />}>
          <LanguageSwitcher className="hidden sm:flex" />
        </Suspense>
        <AccountButton className="hidden lg:inline-flex" labels={{ login: t("nav.login"), dashboard: t("auth.dashboard") }} />
        <Button asChild className="tap hidden bg-saffron font-semibold text-saffron-foreground hover:bg-saffron/90 md:inline-flex">
          <Link href="/dashboard/post">{t("nav.postProperty")}</Link>
        </Button>
        <Suspense fallback={<div className="size-11 lg:hidden" />}>
          <MobileMenu
            siteName={siteName}
            items={[...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => ({ key: i.key, href: i.href, label: t(`nav.${i.key}`) }))}
            labels={{ open: t("a11y.openMenu"), close: t("a11y.closeMenu"), nav: t("a11y.mainNav"), post: t("nav.postProperty"), login: t("nav.login") }}
          />
        </Suspense>
      </div>
    </HeaderShell>
  );
}
