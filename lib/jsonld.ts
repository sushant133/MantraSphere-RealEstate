import type { Locale } from "./constants";
import { SITE_URL, absoluteUrl } from "./seo";
import type { SiteSettings } from "./site";

/** Organization + LocalBusiness (RealEstateAgent) + WebSite with SearchAction (fix #4). */
export function siteJsonLd(settings: SiteSettings, locale: Locale) {
  const orgId = `${SITE_URL}/#organization`;
  return [
    {
      "@context": "https://schema.org",
      "@type": ["Organization", "RealEstateAgent"],
      "@id": orgId,
      name: settings.companyName.en,
      alternateName: settings.companyName.ne,
      legalName: settings.legalName,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      image: `${SITE_URL}/logo.svg`,
      email: settings.email,
      telephone: settings.phones[0],
      address: {
        "@type": "PostalAddress",
        streetAddress: "Dhangadhimai-10",
        addressLocality: "Siraha",
        addressRegion: "Madhesh Province",
        addressCountry: "NP",
      },
      geo: { "@type": "GeoCoordinates", latitude: settings.geo.lat, longitude: settings.geo.lng },
      contactPoint: settings.phones.map((p) => ({
        "@type": "ContactPoint",
        telephone: p,
        contactType: "customer service",
        areaServed: "NP",
        availableLanguage: ["English", "Nepali"],
      })),
      areaServed: { "@type": "Country", name: "Nepal" },
      sameAs: Object.values(settings.social).filter(Boolean),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: absoluteUrl(locale),
      name: settings.companyName[locale],
      inLanguage: locale === "ne" ? "ne-NP" : "en-NP",
      publisher: { "@id": orgId },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(locale, "/properties")}?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** Safe serialisation for <script type="application/ld+json">. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
