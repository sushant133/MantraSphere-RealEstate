import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import { isGoogleEnabled } from "@/lib/auth";
import { getSessionUser, safeNext } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { turnstileSiteKey } from "@/lib/turnstile";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ next?: string; method?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/login", title: t("loginTitle"), description: t("loginMeta"), noindex: true });
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNext(sp.next, locale);
  if (await getSessionUser()) redirect(next);
  const t = await getTranslations({ locale, namespace: "auth" });
  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <IntlScope namespaces={["auth"]}>
        <LoginForm
          locale={locale}
          next={next}
          siteKey={turnstileSiteKey()}
          google={isGoogleEnabled()}
          initialMethod={sp.method === "email" ? "email" : "phone"}
        />
      </IntlScope>
    </AuthShell>
  );
}
