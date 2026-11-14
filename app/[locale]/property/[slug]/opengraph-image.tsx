import { ImageResponse } from "next/og";
import type { Locale } from "@/lib/constants";
import { LOGO_SVG, OG_SIZE, ogFonts, publicImageAsJpeg } from "@/lib/og";
import { displayArea, displayPrice, placeLine } from "@/lib/properties/format";
import { getPropertyDetail } from "@/lib/properties/queries";

/**
 * Per-listing share image: photo + price + location + logo (fix #3).
 * Text is always English: next/og (Satori) cannot shape Devanagari conjuncts,
 * so Nepali would render broken. Both locales share the same image content.
 */
export const runtime = "nodejs";
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MantraSphere Real Estate listing";

export default async function Image({ params }: { params: Promise<{ locale: Locale; slug: string }> | { locale: Locale; slug: string } }) {
  const { slug } = await Promise.resolve(params);
  const locale: Locale = "en";
  const [p, fonts] = await Promise.all([getPropertyDetail(slug), ogFonts()]);
  const brand = "MantraSphere Real Estate";

  if (!p) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#1f2a5c", color: "#fff", fontSize: 56, fontFamily: "Mukta" }}>
          {brand}
        </div>
      ),
      { ...size, fonts },
    );
  }

  const photo = p.images[0] ? await publicImageAsJpeg(p.images[0].url) : null;
  const price = displayPrice(p, locale);
  const priceText = price ? `${price.main}${price.suffix ? ` ${price.suffix}` : ""}` : "Price on request";
  const area = displayArea(p, locale);

  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#1f2a5c", fontFamily: "Mukta" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        ) : null}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", backgroundImage: "linear-gradient(180deg, rgba(20,26,51,0.1) 0%, rgba(20,26,51,0.35) 35%, rgba(20,26,51,0.94) 72%)" }} />
        <div style={{ position: "absolute", top: 36, left: 40, display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 18, padding: "10px 20px 10px 12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SVG} alt="" width={52} height={52} />
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1f2a5c" }}>{brand}</span>
        </div>
        <div style={{ position: "absolute", top: 40, right: 40, display: "flex", background: "#f2a93b", color: "#1f2a5c", borderRadius: 999, padding: "8px 22px", fontSize: 26, fontWeight: 700 }}>
          {p.code}
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, bottom: 36, display: "flex", flexDirection: "column", color: "#fff" }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: "#f7c56b", lineHeight: 1.05 }}>{priceText}</div>
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.2, marginTop: 8, maxWidth: 1100 }}>{p.title[locale]}</div>
          <div style={{ fontSize: 30, marginTop: 6, opacity: 0.9 }}>
            {[area, placeLine(p.locationNames, p.address, locale)].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
