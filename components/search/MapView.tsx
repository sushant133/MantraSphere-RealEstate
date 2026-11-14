"use client";

import dynamic from "next/dynamic";

/** Leaflet is browser-only and heavy: load it only when the map view is chosen. */
export const MapView = dynamic(() => import("./MapViewInner").then((m) => m.MapViewInner), {
  ssr: false,
  loading: () => <div className="h-[70dvh] min-h-96 animate-pulse rounded-2xl bg-muted" />,
});
