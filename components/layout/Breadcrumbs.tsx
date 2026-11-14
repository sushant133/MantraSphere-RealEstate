import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/JsonLd";
import type { Locale } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";

export type Crumb = { name: string; href?: string };

/** Visible breadcrumbs + BreadcrumbList JSON-LD (fix #4). The last crumb is the current page. */
export async function Breadcrumbs({ locale, items }: { locale: Locale; items: Crumb[] }) {
  const t = await getTranslations({ locale, namespace: "detail" });
  const all: Crumb[] = [{ name: t("home"), href: "/" }, ...items];
  return (
    <>
      <nav aria-label={t("breadcrumb")} className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-1">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={`${c.name}-${i}`} className="inline-flex items-center gap-1">
                {last || !c.href ? (
                  <span aria-current={last ? "page" : undefined} className={last ? "line-clamp-1 font-medium text-foreground" : ""}>
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="inline-flex min-h-11 items-center hover:text-foreground hover:underline">
                    {c.name}
                  </Link>
                )}
                {!last ? <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            ...(c.href ? { item: absoluteUrl(locale, c.href.split("?")[0] === "/" ? "/" : c.href) } : {}),
          })),
        }}
      />
    </>
  );
}
