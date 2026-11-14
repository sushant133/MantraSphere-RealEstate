"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { COMPARE_MAX, FULL_EVENT, clearCompare, useCompareCodes } from "./compare-store";

/** Floating bar shown once something is picked for comparison. */
export function CompareBar() {
  const t = useTranslations("compare");
  const codes = useCompareCodes();
  const path = usePathname();
  const [full, setFull] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = () => {
      setFull(true);
      clearTimeout(timer);
      timer = setTimeout(() => setFull(false), 4000);
    };
    window.addEventListener(FULL_EVENT, on);
    return () => {
      window.removeEventListener(FULL_EVENT, on);
      clearTimeout(timer);
    };
  }, []);
  if (!codes.length || path.startsWith("/compare") || path.startsWith("/dashboard") || path.startsWith("/admin")) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4 md:bottom-6">
      <p role="status" className={full ? "max-w-sm rounded-lg bg-foreground px-3 py-2 text-center text-sm text-background shadow" : "sr-only"}>
        {full ? t("full", { max: COMPARE_MAX }) : ""}
      </p>
      <div role="region" aria-label={t("barLabel")} className="flex items-center gap-2 rounded-full bg-navy-900 py-1.5 pl-5 pr-1.5 text-white shadow-lg">
        <span className="text-sm font-medium">{t("selected", { count: codes.length })}</span>
        <Link
          href={`/compare?codes=${codes.join(",")}`}
          className="tap inline-flex items-center gap-1.5 rounded-full bg-saffron px-4 text-sm font-semibold text-saffron-foreground"
        >
          <GitCompareArrows className="size-4" aria-hidden="true" />
          {t("compareNow")}
        </Link>
        <button type="button" onClick={clearCompare} aria-label={t("clear")} className="tap inline-flex items-center justify-center rounded-full px-3 hover:bg-white/10">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
