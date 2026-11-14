import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { StartForm } from "./StartForm";

export default async function PostPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ plan?: string }> }) {
  const { locale } = await params;
  const plan = (await searchParams).plan;
  const planSlug = plan && /^[a-z0-9-]{2,40}$/.test(plan) ? plan : undefined;
  setRequestLocale(locale);
  await requireUser(locale, `/${locale}/dashboard/post${planSlug ? `?plan=${planSlug}` : ""}`);
  const t = await getTranslations({ locale, namespace: "wizard" });
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("newTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("startIntro")}</p>
      <div className="mt-6 rounded-3xl border bg-card p-5 sm:p-8">
        <StartForm locale={locale} planSlug={planSlug} />
      </div>
    </div>
  );
}
