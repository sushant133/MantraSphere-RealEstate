import type { Metadata } from "next";
import { LOCALES, type Locale } from "./constants";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Absolute URL for a locale + path ("/" or "/properties"). */
export function absoluteUrl(locale: Locale, path = "/"): string {
  const p = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}/${locale}${p}`;
}

/** canonical + hreflang alternates for every page (fix #7). */
export function alternatesFor(locale: Locale, path = "/"): Metadata["alternates"] {
  return {
    canonical: absoluteUrl(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l === "ne" ? "ne-NP" : "en-NP", absoluteUrl(l, path)])),
      "x-default": absoluteUrl("en", path),
    },
  };
}

/** Trim to a limit on a word boundary, adding an ellipsis. */
export function clamp(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,.;:\-–\s]+$/, "")}…`;
}

/** Page metadata with titles ≤60 and descriptions ≤155 chars (fix #1), OG + Twitter (fix #3). */
export function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const title = clamp(opts.title, 60);
  const description = clamp(opts.description, 155);
  const url = absoluteUrl(opts.locale, opts.path);
  // A page-level openGraph object replaces the parent's file-based image, so
  // always name one: the page's own, or the locale's default share image.
  const images = [{ url: opts.image ?? `${SITE_URL}/${opts.locale}/opengraph-image`, width: 1200, height: 630, alt: title }];
  return {
    title: { absolute: title },
    description,
    alternates: alternatesFor(opts.locale, opts.path),
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: opts.locale === "ne" ? "मन्त्रास्फियर रियल इस्टेट" : "MantraSphere Real Estate",
      locale: opts.locale === "ne" ? "ne_NP" : "en_US",
      alternateLocale: opts.locale === "ne" ? ["en_US"] : ["ne_NP"],
      images,
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
    robots: opts.noindex ? { index: false, follow: true } : undefined,
  };
}
