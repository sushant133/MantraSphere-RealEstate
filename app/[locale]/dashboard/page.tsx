import { ArrowRight, Eye, FileClock, FilePen, Home, Inbox, PlusCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { ownerLeads, ownerStats } from "@/lib/properties/dashboard-queries";
import { formatDate, localDigits } from "@/lib/properties/format";
import { accentBtn } from "@/components/forms/styles";
import { LeadRow } from "./leads/LeadRow";

export default async function DashboardHome({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard`);
  const [t, stats, leads] = await Promise.all([getTranslations({ locale, namespace: "dashboard" }), ownerStats(user.id), ownerLeads(user.id, undefined, 5)]);
  const n = (v: number) => localDigits(new Intl.NumberFormat("en-IN").format(v), locale);

  const tiles = [
    { label: t("stats.active"), value: stats.active, icon: Home, href: "/dashboard/listings?status=ACTIVE" },
    { label: t("stats.pending"), value: stats.pending, icon: FileClock, href: "/dashboard/listings?status=PENDING_REVIEW" },
    { label: t("stats.drafts"), value: stats.drafts, icon: FilePen, href: "/dashboard/listings?status=DRAFT" },
    { label: t("stats.newLeads"), value: stats.newLeads, icon: Inbox, href: "/dashboard/leads?status=NEW" },
    { label: t("stats.views"), value: stats.views, icon: Eye, href: "/dashboard/listings" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{user.name ? t("hello", { name: user.name }) : t("helloAnon")}</h1>
        <Link href="/dashboard/post" className={accentBtn}>
          <PlusCircle className="size-5" aria-hidden="true" />
          {t("nav.post")}
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <li key={label}>
            <Link href={href} className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
              <Icon className="size-5 text-primary/70" aria-hidden="true" />
              <span className="text-2xl font-bold">{n(value)}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="recent-leads">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-leads" className="text-xl font-semibold text-primary">
            {t("recentLeads")}
          </h2>
          <Link href="/dashboard/leads" className="tap inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            {t("viewAllLeads")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {leads.length ? (
          <ul className="space-y-3">
            {leads.map((l) => (
              <LeadRow key={l.id} lead={l} locale={locale} date={formatDate(l.createdAt, locale)} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("noLeads")}</p>
        )}
      </section>
    </div>
  );
}
