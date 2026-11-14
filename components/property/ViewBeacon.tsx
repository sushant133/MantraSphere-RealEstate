"use client";

import { useEffect } from "react";

/** Counts a view from the browser (detail pages are statically cached). */
export function ViewBeacon({ code }: { code: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/properties/${code}/view`, { method: "POST", keepalive: true }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [code]);
  return null;
}
