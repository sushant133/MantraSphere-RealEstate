"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

/** Single-pin map, loaded only when scrolled into view. */
export function MiniMap({ lng, lat, label }: { lng: number; lat: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!el.current) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(el.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !el.current) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      L.circleMarker([lat, lng], { radius: 10, color: "#fff", weight: 3, fillColor: "#1f2a5c", fillOpacity: 1 }).addTo(map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [visible, lat, lng]);

  return <div ref={el} role="region" aria-label={label} className="h-72 overflow-hidden rounded-2xl border bg-muted" />;
}
