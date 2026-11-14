import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/constants";
import { inter, mukta } from "@/lib/fonts";
import { SITE_URL, alternatesFor } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site";
import { siteJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { IntlScope } from "@/components/IntlScope";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { CompareBar } from "@/components/property/CompareBar";
import { RegisterSW } from "@/components/RegisterSW";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("defaultTitle"), template: `%s | ${t("siteName")}` },
    description: t("defaultDescription"),
    applicationName: t("siteName"),
    alternates: alternatesFor(locale),
    icons: {
      icon: [
        { url: "/logo.svg", type: "image/svg+xml" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "MantraSphere", statusBarStyle: "default" },
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("defaultTitle"),
      description: t("defaultDescription"),
      locale: locale === "ne" ? "ne_NP" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: t("defaultTitle"),
      description: t("defaultDescription"),
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141a33" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [settings, t] = await Promise.all([
    getSiteSettings(),
    getTranslations({ locale, namespace: "a11y" }),
  ]);
  const l = locale as Locale;

  return (
    <html
      lang={l === "ne" ? "ne" : "en"}
      className={`${inter.variable} ${mukta.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {t("skipToContent")}
        </a>
        <IntlScope namespaces={["common", "nav", "error", "compare"]}>
          <Header locale={l} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer locale={l} settings={settings} />
          <MobileBottomBar locale={l} phone={settings.phones[0]} />
          <CompareBar />
          <RegisterSW />
        </IntlScope>
        <JsonLd data={siteJsonLd(settings, l)} />
      </body>
    </html>
  );
}
