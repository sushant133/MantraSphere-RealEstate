import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import type { Locale } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { AuthShell } from "../AuthShell";
import { ResetForm } from "../AuthForms";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/reset-password", title: t("resetTitle"), description: t("forgotBody"), noindex: true });
}

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token = "" } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  return (
    <AuthShell title={t("resetTitle")}>
      <IntlScope namespaces={["auth"]}>
        <ResetForm token={token} />
      </IntlScope>
    </AuthShell>
  );
}
