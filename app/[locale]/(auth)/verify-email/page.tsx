import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import type { Locale } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { AuthShell } from "../AuthShell";
import { ConfirmEmail } from "../AuthForms";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/verify-email", title: t("verifyTitle"), description: t("registerMeta"), noindex: true });
}

/** Confirmation needs a click: link scanners that prefetch URLs must not consume the token. */
export default async function VerifyEmailPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token = "" } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  return (
    <AuthShell title={t("verifyTitle")}>
      <IntlScope namespaces={["auth"]}>
        <ConfirmEmail token={token} />
      </IntlScope>
    </AuthShell>
  );
}
