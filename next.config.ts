import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Tightened further in Phase 7 (nonces) once
 * analytics, Turnstile and payment domains are finalised.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://i.ytimg.com${process.env.STORAGE_PUBLIC_HOST ? ` https://${process.env.STORAGE_PUBLIC_HOST}` : ""}`,
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://rc-epay.esewa.com.np https://epay.esewa.com.np https://pay.khalti.com https://test-pay.khalti.com",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Optional separate build dir (e.g. verifying a build while a dev server owns .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Always render <title>/<meta> in <head> (not streamed into <body>) so every
  // crawler and link-preview bot sees them (fix #1, #3).
  htmlLimitedBots: /.*/,
  reactStrictMode: true,
  images: {
    // Pre-sized WebP variants (see lib/image-loader.ts); no on-the-fly resizing.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 256, 400],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "radix-ui"],
  },
  serverExternalPackages: ["mongoose", "sharp"],
  // Fonts read at runtime by next/og (lib/og.tsx) must ship with the standalone build.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**", "./data/**"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Uploaded images have content-addressed names: cache for a year.
      { source: "/uploads/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // The service worker must always be re-checked so updates roll out.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
