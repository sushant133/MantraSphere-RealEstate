"use client";

import { useEffect, useState } from "react";
import { Check, Link2, MessageCircle, Phone, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
    </svg>
  );
}

/** Share to Facebook / WhatsApp / Viber, copy link, or the native share sheet. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations("detail");
  const [copied, setCopied] = useState(false);
  const text = `${title} ${url}`;
  const [canNative, setCanNative] = useState(false);
  useEffect(() => setCanNative("share" in navigator), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const item = "tap inline-flex items-center justify-center rounded-full border bg-background hover:bg-muted";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">{t("share")}</span>
      {canNative ? (
        <button type="button" className={item} aria-label={t("share")} onClick={() => navigator.share({ title, url }).catch(() => {})}>
          <Share2 className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      <a className={item} aria-label={t("shareFacebook")} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
        <FacebookIcon />
      </a>
      <a className={item} aria-label={t("shareWhatsapp")} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-4" aria-hidden="true" />
      </a>
      <a className={item} aria-label={t("shareViber")} href={`viber://forward?text=${encodeURIComponent(text)}`}>
        <Phone className="size-4" aria-hidden="true" />
      </a>
      <button type="button" className={item} aria-label={copied ? t("linkCopied") : t("copyLink")} onClick={copy}>
        {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? t("linkCopied") : ""}
      </span>
    </div>
  );
}
