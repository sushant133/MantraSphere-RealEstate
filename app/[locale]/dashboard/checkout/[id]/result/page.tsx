import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { outlineBtn, primaryBtn } from "@/components/forms/styles";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { loadOwnPayment } from "@/lib/payments/owner-view";
import { verifyGatewayPayment } from "@/lib/payments/service";

export default async function PaymentResult({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/checkout/${id}/result`);
  let p = await loadOwnPayment(id, user.id);
  if (!p) notFound();
  // A gateway return may have been missed (closed tab): ask the provider once more.
  if (p.status === "INITIATED" && (p.provider === "ESEWA" || p.provider === "KHALTI")) {
    await verifyGatewayPayment(p.id).catch(() => null);
    p = (await loadOwnPayment(id, user.id))!;
  }
  const t = await getTranslations({ locale, namespace: "checkout" });
  // INITIATED without a provider = the last attempt failed and was cleared.
  const state =
    p.status === "COMPLETED" ? "ok" : p.status === "PENDING_VERIFICATION" ? "bank" : p.status === "INITIATED" && p.provider ? "pending" : "failed";
  const Icon = state === "ok" ? CheckCircle2 : state === "failed" ? XCircle : Clock;

  return (
    <div className="mx-auto max-w-lg rounded-3xl border bg-card p-8 text-center">
      <Icon className={state === "ok" ? "mx-auto size-12 text-success" : state === "failed" ? "mx-auto size-12 text-destructive" : "mx-auto size-12 text-price"} aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-primary">{t("resultTitle")}</h1>
      <div role="status" className="mt-3 space-y-1">
        {state === "ok" ? (
          <>
            <p className="font-semibold">{t("resultCompleted")}</p>
            <p className="text-muted-foreground">{p.purpose === "RENEWAL" ? t("resultCompletedRenewal") : t("resultCompletedNew")}</p>
          </>
        ) : state === "bank" ? (
          <p>{t("resultBank")}</p>
        ) : state === "pending" ? (
          <p>{t("resultPending")}</p>
        ) : (
          <p>{t("resultFailed")}</p>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("invoice", { no: p.invoiceNo })}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {p.status === "INITIATED" ? (
          // Full page load: a payment retry starts from a clean page (no pending client-router work).
          <a href={`/${locale}/dashboard/checkout/${p.id}`} className={primaryBtn}>
            {t("tryAgain")}
          </a>
        ) : null}
        {state === "pending" ? (
          <Link href={`/dashboard/checkout/${p.id}/result`} className={outlineBtn}>
            {t("refresh")}
          </Link>
        ) : null}
        <Link href="/dashboard/listings" className={outlineBtn}>
          {t("toListings")}
        </Link>
      </div>
    </div>
  );
}
