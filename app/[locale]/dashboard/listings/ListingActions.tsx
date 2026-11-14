"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { outlineBtn, primaryBtn } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { deleteListing, markClosed, reopenForEdit } from "../actions";

/** Status-dependent actions for one listing, with confirmations for anything destructive. */
export function ListingActions({ id, code, slug, status, purpose, locale }: { id: string; code: string; slug: string; status: string; purpose: string; locale: "en" | "ne" }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const btn = cn(outlineBtn, "h-11 px-3 text-sm");

  const run = (fn: () => Promise<{ ok: boolean } | void>) =>
    start(async () => {
      setError(false);
      const r = await fn();
      if (r && !r.ok) setError(true);
      router.refresh();
    });

  const closedLabel = purpose === "SALE" ? t("status.SOLD") : t("status.RENTED");

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("actions", { code })}>
      {status === "DRAFT" || status === "REJECTED" ? (
        <Link href={`/dashboard/listings/${id}/edit`} className={cn(primaryBtn, "h-11 px-4 text-sm")}>
          {t("continue")}
        </Link>
      ) : null}
      {["ACTIVE", "SOLD", "RENTED"].includes(status) ? (
        <Link href={`/property/${slug}`} className={btn}>
          {t("view")}
        </Link>
      ) : null}
      {["ACTIVE", "EXPIRED", "PENDING_REVIEW"].includes(status) ? (
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => {
            if (status !== "ACTIVE" || window.confirm(t("confirmEditLive", { code }))) run(() => reopenForEdit(id, locale));
          }}
        >
          {t("edit")}
        </button>
      ) : null}
      {status === "ACTIVE" || status === "EXPIRED" ? (
        <Link href={`/dashboard/listings/${id}/renew`} className={cn(primaryBtn, "h-11 px-4 text-sm")}>
          {t("renew")}
        </Link>
      ) : null}
      {status === "ACTIVE" ? (
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => window.confirm(t("confirmClosed", { code, status: closedLabel })) && run(() => markClosed(id))}
        >
          {purpose === "SALE" ? t("markSold") : t("markRented")}
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className={cn(btn, "text-destructive")}
        onClick={() => window.confirm(t("confirmDelete", { code })) && run(() => deleteListing(id))}
      >
        {t("delete")}
      </button>
      {error ? <p role="alert" className="w-full text-sm text-destructive">{t("saveError")}</p> : null}
    </div>
  );
}
