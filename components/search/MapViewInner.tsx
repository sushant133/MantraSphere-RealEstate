"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type { MapPointDTO } from "@/lib/properties/dto";
import { displayPrice } from "@/lib/properties/format";

const NEPAL_BOUNDS: L.LatLngBoundsExpression = [
  [26.3, 80.0],
  [30.5, 88.3],
];

type Labels = { loading: string; truncated: string; empty: string; mapLabel: string; priceOnRequest: string };

/** Clustered map of search results. Popups are built with DOM APIs (no HTML strings → no XSS). */
export function MapViewInner({ query, locale, labels }: { query: string; locale: "en" | "ne"; labels: Labels }) {
  const el = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "truncated">("loading");

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, maxBounds: [[25.5, 79], [31, 89.5]] }).fitBounds(NEPAL_BOUNDS);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
    map.addLayer(cluster);

    let aborted = false;
    let truncated = false;
    let ctrl: AbortController | null = null;

    const render = (points: MapPointDTO[]) => {
      cluster.clearLayers();
      for (const p of points) {
        const price = displayPrice(p, locale);
        const label = price ? `${price.main}${price.suffix ? ` ${price.suffix}` : ""}` : labels.priceOnRequest;
        const icon = L.divIcon({ className: "msr-pin", html: "", iconSize: undefined });
        const marker = L.marker([p.lat, p.lng], { icon, title: p.title[locale], alt: p.title[locale], keyboard: true });
        marker.on("add", () => {
          const node = marker.getElement();
          if (node) node.textContent = price ? price.main : "•";
        });
        const box = document.createElement("div");
        const a = document.createElement("a");
        a.href = `/${locale}/property/${p.slug}`;
        a.textContent = p.title[locale];
        a.className = "msr-pop-title";
        const pr = document.createElement("p");
        pr.textContent = label;
        pr.className = "msr-pop-price";
        box.append(a, pr);
        marker.bindPopup(box);
        cluster.addLayer(marker);
      }
    };

    const fetchPoints = async (bbox?: L.LatLngBounds) => {
      ctrl?.abort();
      ctrl = new AbortController();
      const qs = new URLSearchParams(query);
      if (bbox) qs.set("bbox", [bbox.getWest(), bbox.getSouth(), bbox.getEast(), bbox.getNorth()].map((n) => n.toFixed(5)).join(","));
      try {
        const res = await fetch(`/api/properties/map?${qs}`, { signal: ctrl.signal });
        const data = (await res.json()) as { points: MapPointDTO[]; truncated: boolean };
        if (aborted) return;
        render(data.points);
        truncated = data.truncated;
        setStatus(data.points.length === 0 ? "empty" : data.truncated ? "truncated" : "ok");
        if (!bbox && data.points.length) {
          map.fitBounds(L.latLngBounds(data.points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2), { maxZoom: 14 });
        }
      } catch {
        /* aborted or offline: keep current markers */
      }
    };

    fetchPoints();
    // Only refetch by viewport when the first result set was capped.
    map.on("moveend", () => {
      if (truncated) fetchPoints(map.getBounds());
    });

    return () => {
      aborted = true;
      ctrl?.abort();
      map.remove();
    };
  }, [query, locale, labels.priceOnRequest]);

  return (
    <div>
      <div ref={el} role="region" aria-label={labels.mapLabel} className="h-[70dvh] min-h-96 overflow-hidden rounded-2xl border" />
      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
        {status === "loading" ? labels.loading : status === "empty" ? labels.empty : status === "truncated" ? labels.truncated : ""}
      </p>
    </div>
  );
}
