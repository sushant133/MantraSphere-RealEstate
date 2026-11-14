import { BellRing, CheckCircle2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { formatDate } from "@/lib/properties/format";
import { canonicalAlertQuery, describeSearch, MAX_SAVED_SEARCHES } from "@/lib/search-alerts";
import { cn } from "@/lib/utils";
import { SavedSearch, User } from "@/models";
import { NewSearchForm, SearchRowActions } from "./SearchForms";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ save?: string; saved?: string }> };

export default async function SavedSearchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const saveQs = typeof sp.save === "string" ? sp.save.slice(0, 1000) : null;
  const user = await requireUser(locale, `/${locale}/dashboard/searches${saveQs != null ? `?save=${encodeURIComponent(saveQs)}` : ""}`);
  const t = await getTranslations({ locale, namespace: "searches" });
  await connectDB();
  const [rows, u] = await Promise.all([
    SavedSearch.find({ user: user.id }).sort({ createdAt: -1 }).lean(),
    User.findById(user.id).select("email emailVerified phone").lean(),
  ]);
  const items = await Promise.all(
    rows.map(async (r) => ({
      id: String(r._id),
      name: r.name || (await describeSearch(r.query, locale)),
      summary: await describeSearch(r.query, locale),
      query: r.query,
      frequency: r.frequency,
      channels: r.channels ?? [],
      active: r.active !== false,
      last: r.lastNotifiedAt ? formatDate(r.lastNotifiedAt.toISOString(), locale) : null,
    })),
  );
  const pendingQuery = saveQs != null ? canonicalAlertQuery(saveQs) : null;
  const alreadySaved = pendingQuery != null && rows.some((r) => r.query === pendingQuery);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("intro")}</p>

      {sp.saved ? (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-xl bg-success/10 p-4 font-medium text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {t("savedNotice")}
        </p>
      ) : null}

      {pendingQuery != null && !alreadySaved ? (
        <section aria-labelledby="new-search" className="mt-6">
          <h2 id="new-search" className="text-lg font-semibold">
            {t("newTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{await describeSearch(pendingQuery, locale)}</p>
          {items.length >= MAX_SAVED_SEARCHES ? (
            <p className="mt-3 text-sm text-destructive">{t("errors.limit")}</p>
          ) : (
            <NewSearchForm query={pendingQuery} defaultName={await describeSearch(pendingQuery, locale)} canEmail={!!(u?.email && u.emailVerified)} canSms={!!u?.phone} />
          )}
        </section>
      ) : null}

      {items.length ? (
        <ul className="mt-6 space-y-3">
          {items.map((s) => (
            <li key={s.id} className={cn("rounded-2xl border bg-card p-5", !s.active && "opacity-75")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{s.name}</h2>
                  {s.name !== s.summary ? <p className="text-sm text-muted-foreground">{s.summary}</p> : null}
                  <p className="mt-1 text-sm">
                    {s.active ? t(`frequencies.${s.frequency as "DAILY"}`) : t("paused")}
                    {" · "}
                    {s.channels.map((c) => (c === "EMAIL" ? t("byEmail") : t("bySms"))).join(", ")}
                  </p>
                  {s.last ? <p className="text-xs text-muted-foreground">{t("lastChecked", { date: s.last })}</p> : null}
                </div>
                <SearchRowActions id={s.id} active={s.active} name={s.name} />
              </div>
              <Link href={`/properties${s.query ? `?${s.query}&sort=newest` : "?sort=newest"}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
                {t("viewResults")}
              </Link>
            </li>
          ))}
        </ul>
      ) : pendingQuery == null ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <BellRing className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 max-w-md">{t("empty")}</p>
          <Link href="/properties" className="tap mt-6 inline-flex items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            {t("browse")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
