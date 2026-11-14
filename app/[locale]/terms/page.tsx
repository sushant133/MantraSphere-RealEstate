import { setRequestLocale } from "next-intl/server";
import { LegalPageView, legalMetadata } from "@/components/content/LegalPage";
import type { Locale } from "@/lib/constants";

export const revalidate = 3600;
type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata((await params).locale, "terms");
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPageView locale={locale} slug="terms" />;
}
