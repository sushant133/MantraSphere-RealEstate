import type { MetadataRoute } from "next";

/** Web app manifest: installable on Android/desktop; iOS uses apple-touch-icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MantraSphere Real Estate",
    short_name: "MantraSphere",
    description: "Buy, sell and rent houses, land, flats and commercial space across Nepal.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1f2a5c",
    lang: "en",
    categories: ["business", "lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Search properties", url: "/en/properties", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Post a property", url: "/en/dashboard/post", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Saved properties", url: "/en/saved", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
