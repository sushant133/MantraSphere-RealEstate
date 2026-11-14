import { Inter, Mukta } from "next/font/google";

/**
 * `display: "optional"`: text paints immediately in the metric-matched
 * fallback and never re-flows when the web font arrives (protects LCP and
 * CLS on slow 4G). Cached fonts are used on later page views.
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "optional",
});

/** Devanagari is only needed on /ne pages, so it is not preloaded everywhere. */
export const mukta = Mukta({
  subsets: ["devanagari"],
  weight: ["400", "700"],
  variable: "--font-mukta",
  display: "optional",
  preload: false,
});
