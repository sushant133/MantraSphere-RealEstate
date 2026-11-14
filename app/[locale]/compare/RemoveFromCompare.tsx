"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { removeCompare, useCompareCodes } from "@/components/property/compare-store";

/**
 * Removes one listing from the comparison and updates the URL. The URL is the
 * source of truth for this page (shareable); the device list follows it.
 */
export function RemoveFromCompare({ code, codes }: { code: string; codes: string[] }) {
  const t = useTranslations("compare");
  const router = useRouter();
  const stored = useCompareCodes();
  useEffect(() => {
    // Opening a shared link adopts its selection on this device.
    if (code === codes[0] && stored.join(",") !== codes.join(",")) {
      try {
        localStorage.setItem("msr:compare", JSON.stringify(codes));
        window.dispatchEvent(new Event("msr:compare-change"));
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(",")]);
  return (
    <button
      type="button"
      onClick={() => {
        removeCompare(code);
        const rest = codes.filter((c) => c !== code);
        router.replace(rest.length ? `/compare?codes=${rest.join(",")}` : "/compare");
      }}
      className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-destructive hover:underline"
    >
      {t("remove")}
    </button>
  );
}
