import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { ownerLeads } from "@/lib/properties/dashboard-queries";
import { formatDate } from "@/lib/properties/format";
import { cn } from "@/lib/utils";
import { LeadRow } from "./LeadRow";

export default async function LeadsPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status } = await searchParams;
  const user = await requireUser(locale, `/${locale}/dashboard/leads`);
  const [t, leads] = await Promise.all([getTranslations({ locale, namespace: "dashboard" }), ownerLeads(user.id, status)]);
  const filters = [undefined, "NEW", "CONTACTED", "CLOSED"] as const;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("leadsTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("leadsIntro")}</p>
      <nav aria-label={t("leadStatusLabel")} className="mt-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f ?? "all"}
            href={f ? `/dashboard/leads?status=${f}` : "/dashboard/leads"}
            aria-current={status === f || (!status && !f) ? "page" : undefined}
            className={cn(
              "tap inline-flex items-center rounded-full border px-4 text-sm font-medium",
              status === f || (!status && !f) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {f ? t(`leadStatus.${f}`) : t("filterAll")}
          </Link>
        ))}
      </nav>
      {leads.length ? (
        <ul className="mt-6 space-y-3">
          {leads.map((l) => (
            <LeadRow key={l.id} lead={l} locale={locale} date={formatDate(l.createdAt, locale)} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("noLeads")}</p>
      )}
    </div>
  );
}
