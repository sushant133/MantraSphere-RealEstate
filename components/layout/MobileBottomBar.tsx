import { Heart, Phone, PlusCircle, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/constants";
import { telHref } from "@/lib/phone";

/** App-style sticky bottom bar on mobile: Search, Saved, Post, Call. */
export async function MobileBottomBar({ locale, phone }: { locale: Locale; phone: string }) {
  const t = await getTranslations({ locale, namespace: "nav" });
  const a11y = await getTranslations({ locale, namespace: "a11y" });
  const item = "tap flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.7rem] font-medium";

  return (
    <nav
      aria-label={a11y("mobileNav")}
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="flex">
        <li className="flex flex-1">
          <Link href="/properties" className={item}>
            <Search className="size-5" aria-hidden="true" />
            {t("search")}
          </Link>
        </li>
        <li className="flex flex-1">
          <Link href="/saved" className={item}>
            <Heart className="size-5" aria-hidden="true" />
            {t("saved")}
          </Link>
        </li>
        <li className="flex flex-1">
          <Link href="/dashboard/post" className={`${item} text-primary`}>
            <PlusCircle className="size-6" aria-hidden="true" />
            {t("post")}
          </Link>
        </li>
        <li className="flex flex-1">
          <a href={telHref(phone)} className={item}>
            <Phone className="size-5" aria-hidden="true" />
            {t("call")}
          </a>
        </li>
      </ul>
    </nav>
  );
}
