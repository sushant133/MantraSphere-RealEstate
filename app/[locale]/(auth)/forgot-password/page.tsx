import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import type { Locale } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { turnstileSiteKey } from "@/lib/turnstile";
import { AuthShell } from "../AuthShell";
import { ForgotForm } from "../AuthForms";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/forgot-password", title: t("forgotTitle"), description: t("forgotBody"), noindex: true });
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  return (
    <AuthShell title={t("forgotTitle")} subtitle={t("forgotBody")}>
      <IntlScope namespaces={["auth"]}>
        <ForgotForm locale={locale} siteKey={turnstileSiteKey()} />
      </IntlScope>
    </AuthShell>
  );
}
