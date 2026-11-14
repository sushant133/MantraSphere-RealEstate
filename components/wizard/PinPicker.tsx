"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { Crosshair } from "lucide-react";
import type { Map as LMap, Marker } from "leaflet";
import { outlineBtn } from "@/components/forms/styles";

const NEPAL: [number, number] = [28.2, 84.1];
const inNepal = (lat: number, lng: number) => lat >= 26 && lat <= 31 && lng >= 79 && lng <= 89;

/** Tap to drop a pin, drag to adjust, or use the device location. */
export function PinPicker({
  lat,
  lng,
  center,
  onChange,
  labels,
}: {
  lat: number | null;
  lng: number | null;
  center: [number, number] | null; // [lng, lat] of the district, if known
  onChange: (lat: number, lng: number) => void;
  labels: { map: string; useMyLocation: string };
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const placeRef = useRef<((lat: number, lng: number) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const start: [number, number] = lat != null && lng != null ? [lat, lng] : center ? [center[1], center[0]] : NEPAL;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView(start, lat != null ? 16 : center ? 12 : 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const icon = L.divIcon({ className: "msr-pin-drop", html: "", iconSize: [28, 28], iconAnchor: [14, 28] });
      const place = (la: number, ln: number) => {
        if (!inNepal(la, ln)) return;
        if (!marker.current) {
          marker.current = L.marker([la, ln], { draggable: true, icon, keyboard: true }).addTo(m);
          marker.current.on("dragend", () => {
            const p = marker.current!.getLatLng();
            cb.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
          });
        } else marker.current.setLatLng([la, ln]);
        cb.current(+la.toFixed(6), +ln.toFixed(6));
      };
      if (lat != null && lng != null) {
        marker.current = L.marker([lat, lng], { draggable: true, icon, keyboard: true }).addTo(m);
        marker.current.on("dragend", () => {
          const p = marker.current!.getLatLng();
          cb.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
        });
      }
      m.on("click", (e) => place(e.latlng.lat, e.latlng.lng));
      map.current = m;
      placeRef.current = place;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; later pin changes come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-centre when a district is chosen and no pin exists yet.
  useEffect(() => {
    if (center && map.current && !marker.current) map.current.setView([center[1], center[0]], 12);
  }, [center]);

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        placeRef.current?.(latitude, longitude);
        map.current?.setView([latitude, longitude], 17);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 },
    );

  return (
    <div className="space-y-2">
      <div ref={el} role="application" aria-label={labels.map} className="h-80 overflow-hidden rounded-2xl border bg-muted" />
      <button type="button" onClick={locate} className={outlineBtn}>
        <Crosshair className="size-4" aria-hidden="true" />
        {labels.useMyLocation}
      </button>
    </div>
  );
}
