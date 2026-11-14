"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
    __tsLoading?: Promise<void>;
  }
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (window.__tsLoading) return window.__tsLoading;
  window.__tsLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
  return window.__tsLoading;
}

/**
 * Cloudflare Turnstile widget, loaded only when a form is on screen and a
 * site key is configured. Writes the token into `cf-turnstile-response`.
 */
export function Turnstile({ siteKey, onToken, locale }: { siteKey: string; onToken: (t: string) => void; locale: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          language: locale === "ne" ? "ne" : "en",
          appearance: "interaction-only",
          callback: onToken,
          "expired-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, onToken, locale]);
  if (!siteKey) return null;
  return <div ref={ref} className="min-h-0" />;
}
