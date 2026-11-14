import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import { getSessionUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { logout } from "../(auth)/actions";
import { SavedSync } from "@/components/property/SavedSync";
import { DashNav } from "./DashNav";

export const metadata: Metadata = { robots: { index: false, follow: false } };
// Session-dependent: never prerender.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  // Each page calls requireUser() with its own path so login returns to the right page.
  const user = await getSessionUser();
  if (!user) return children;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const ta = await getTranslations({ locale, namespace: "auth" });

  return (
    <IntlScope namespaces={["common", "property", "dashboard", "wizard", "detail", "search", "checkout", "searches"]}>
      <div className="container-page py-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-10">
        <aside className="lg:col-span-3">
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 hidden truncate px-3 text-sm text-muted-foreground lg:block">{user.name || user.email || t("helloAnon")}</p>
            <DashNav
              menuLabel={t("menu")}
              labels={{ overview: t("nav.overview"), listings: t("nav.listings"), post: t("nav.post"), leads: t("nav.leads"), searches: t("nav.searches"), payments: t("nav.payments"), profile: t("nav.profile") }}
            />
            <form action={logout.bind(null, locale)} className="mt-2 hidden lg:block">
              <button type="submit" className="tap flex w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted">
                <LogOut className="size-4" aria-hidden="true" />
                {ta("logout")}
              </button>
            </form>
          </div>
        </aside>
        <div className="mt-6 min-w-0 lg:col-span-9 lg:mt-0">{children}</div>
        <SavedSync />
      </div>
    </IntlScope>
  );
}
