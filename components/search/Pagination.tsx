import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/constants";
import { localDigits } from "@/lib/properties/format";
import { cn } from "@/lib/utils";

/** Real ?page= links (crawlable). Hidden by InfiniteList once JS takes over. */
export async function Pagination({
  locale,
  page,
  pages,
  href,
}: {
  locale: Locale;
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations({ locale, namespace: "search" });
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const nums = [...set].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) items.push("gap");
    items.push(n);
  });
  const cell = "tap inline-flex items-center justify-center rounded-xl px-3 text-sm font-semibold";

  return (
    <nav id="pagination" aria-label={t("pagination")} className="mt-10 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={cn(cell, "gap-1 hover:bg-muted")}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              {t("previous")}
            </Link>
          ) : null}
        </li>
        {items.map((n, i) =>
          n === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-label={t("pageN", { page: n })}
                aria-current={n === page ? "page" : undefined}
                className={cn(cell, n === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {localDigits(String(n), locale)}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={href(page + 1)} rel="next" className={cn(cell, "gap-1 hover:bg-muted")}>
              {t("next")}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
