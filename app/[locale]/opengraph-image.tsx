import { ImageResponse } from "next/og";
import type { Locale } from "@/lib/constants";
import { LOGO_SVG, OG_SIZE, ogFonts } from "@/lib/og";

/** Default share image for every page without its own (fix #3). English text: Satori cannot shape Devanagari. */
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MantraSphere Real Estate";

export default async function Image({ params }: { params: Promise<{ locale: Locale }> | { locale: Locale } }) {
  await Promise.resolve(params);
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 64, backgroundImage: "linear-gradient(135deg, #1f2a5c 0%, #2f3f86 100%)", color: "#fff", fontFamily: "Mukta" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SVG} alt="" width={88} height={88} style={{ borderRadius: 20, border: "3px solid rgba(255,255,255,0.3)" }} />
          <span style={{ fontSize: 44, fontWeight: 700 }}>MantraSphere Real Estate</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>Find your place in Nepal</div>
          <div style={{ fontSize: 34, marginTop: 16, color: "#f7c56b" }}>
            Houses · Land · Flats · Commercial space
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
