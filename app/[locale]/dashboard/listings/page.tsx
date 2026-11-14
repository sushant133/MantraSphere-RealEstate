import Image from "next/image";
import { CheckCircle2, Home } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { accentBtn } from "@/components/forms/styles";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { ownerListings } from "@/lib/properties/dashboard-queries";
import { formatDate } from "@/lib/properties/format";
import { cn } from "@/lib/utils";
import { ListingActions } from "./ListingActions";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING_REVIEW: "bg-saffron/25 text-foreground",
  DRAFT: "bg-muted text-muted-foreground",
  REJECTED: "bg-destructive/10 text-destructive",
  SOLD: "bg-primary/10 text-primary",
  RENTED: "bg-primary/10 text-primary",
  EXPIRED: "bg-muted text-muted-foreground",
};

const FILTERS = [undefined, "ACTIVE", "PENDING_REVIEW", "DRAFT", "CLOSED", "EXPIRED"] as const;

export default async function MyListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string; submitted?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const user = await requireUser(locale, `/${locale}/dashboard/listings`);
  const [t, listings] = await Promise.all([getTranslations({ locale, namespace: "dashboard" }), ownerListings(user.id, sp.status)]);
  const submitted = sp.submitted && /^MSR-\d{6,}$/.test(sp.submitted) ? sp.submitted : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("listingsTitle")}</h1>
        <Link href="/dashboard/post" className={accentBtn}>
          {t("nav.post")}
        </Link>
      </div>

      {submitted ? (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-xl bg-success/10 p-4 text-sm font-medium text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {t("submitted", { code: submitted })}
        </p>
      ) : null}

      <nav aria-label={t("listingsTitle")} className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const current = sp.status === f || (!sp.status && !f);
          return (
            <Link
              key={f ?? "all"}
              href={f ? `/dashboard/listings?status=${f}` : "/dashboard/listings"}
              aria-current={current ? "page" : undefined}
              className={cn("tap inline-flex items-center rounded-full border px-4 text-sm font-medium", current ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {!f ? t("filterAll") : f === "CLOSED" ? `${t("status.SOLD")} / ${t("status.RENTED")}` : t(`status.${f}`)}
            </Link>
          );
        })}
      </nav>

      {listings.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <Home className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-muted-foreground">{t("emptyListings")}</p>
          <Link href="/dashboard/post" className={cn(accentBtn, "mt-5")}>
            {t("postFirst")}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row">
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-40">
                {l.cover ? <Image src={l.cover} alt="" fill sizes="160px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[l.status] ?? "bg-muted")}>{t(`status.${l.status}` as "status.DRAFT")}</span>
                  <span className="font-mono text-xs text-muted-foreground">{l.code}</span>
                </div>
                <h2 className="line-clamp-2 font-semibold">{l.title[locale] || t("untitled")}</h2>
                <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span>{t("views", { count: l.views })}</span>
                  <span>{t("leads", { count: l.leads })}</span>
                  {l.plan ? <span>{t("plan", { plan: l.plan[locale] })}</span> : null}
                  {l.status === "ACTIVE" ? <span>{l.untilSold ? t("untilSold") : l.expiresAt ? t("expires", { date: formatDate(l.expiresAt, locale) }) : null}</span> : null}
                  <span>{t("updated", { date: formatDate(l.updatedAt, locale) })}</span>
                </p>
                {l.status === "PENDING_REVIEW" ? <p className="text-sm">{t("warningPending")}</p> : null}
                {l.status === "REJECTED" && l.rejectionReason ? <p className="text-sm text-destructive">{t("rejected", { reason: l.rejectionReason })}</p> : null}
                <ListingActions id={l.id} code={l.code} slug={l.slug} status={l.status} purpose={l.purpose} locale={locale} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
