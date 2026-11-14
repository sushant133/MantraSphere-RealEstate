"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localDigits } from "@/lib/properties/format";
import type { ImageDTO } from "@/lib/properties/dto";
import { cn } from "@/lib/utils";

/**
 * Swipeable gallery (CSS scroll-snap, works without JS), thumbnails and a
 * fullscreen view in a native <dialog> (focus trap + Esc for free).
 */
export function Gallery({ images, title }: { images: ImageDTO[]; title: string }) {
  const t = useTranslations("detail");
  const locale = useLocale() as "en" | "ne";
  const d = (n: number) => localDigits(String(n), locale);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const fullTrack = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const total = images.length;

  const go = useCallback((i: number, el = track.current) => {
    if (!el) return;
    const n = (i + total) % total;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [total]);

  // Keep the counter in sync with swipes.
  useEffect(() => {
    const els = [track.current, fullTrack.current].filter(Boolean) as HTMLDivElement[];
    const handlers = els.map((el) => {
      const h = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
      el.addEventListener("scroll", h, { passive: true });
      return () => el.removeEventListener("scroll", h);
    });
    return () => handlers.forEach((off) => off());
  }, []);

  const openFull = (i: number) => {
    dialog.current?.showModal();
    requestAnimationFrame(() => fullTrack.current?.scrollTo({ left: i * (fullTrack.current?.clientWidth ?? 0) }));
  };

  if (!total) {
    return <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-muted text-muted-foreground">{t("noPhotos")}</div>;
  }

  const navBtn = "tap absolute top-1/2 z-10 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-white/90 text-foreground shadow hover:bg-white";

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <div ref={track} className="flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={title} role="region" tabIndex={0}>
          {images.map((img, i) => (
            <div key={img.url + i} className="relative h-full w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={t("photoOf", { n: d(i + 1), total: d(total) })}>
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="(min-width: 1280px) 820px, (min-width: 1024px) 64vw, 100vw"
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                placeholder={img.blurDataURL ? "blur" : "empty"}
                blurDataURL={img.blurDataURL || undefined}
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {total > 1 ? (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label={t("prevPhoto")} className={cn(navBtn, "left-3")}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label={t("nextPhoto")} className={cn(navBtn, "right-3")}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white" aria-live="polite">
            {t("photoOf", { n: d(index + 1), total: d(total) })}
          </span>
          <button type="button" onClick={() => openFull(index)} className="tap inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 text-sm font-semibold shadow hover:bg-white">
            <Expand className="size-4" aria-hidden="true" />
            {t("viewAllPhotos", { count: d(total) })}
          </button>
        </div>
      </div>

      {total > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={t("thumbnails")}>
          {images.map((img, i) => (
            <li key={img.url + i} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t("photoOf", { n: d(i + 1), total: d(total) })}
                aria-current={i === index ? "true" : undefined}
                className={cn("relative block h-16 w-24 overflow-hidden rounded-lg ring-offset-2", i === index ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100")}
              >
                <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog ref={dialog} aria-label={title} className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 backdrop:bg-black">
        <div className="relative h-full w-full">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={t("closeGallery")}
            className="tap absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-full bg-white/90 text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
          <div ref={fullTrack} className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((img, i) => (
              <div key={img.url + i} className="relative h-full w-full shrink-0 snap-center">
                <Image src={img.url} alt={img.alt} fill sizes="100vw" loading="lazy" className="object-contain" />
              </div>
            ))}
          </div>
          {total > 1 ? (
            <>
              <button type="button" onClick={() => go(index - 1, fullTrack.current)} aria-label={t("prevPhoto")} className={cn(navBtn, "left-3")}>
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => go(index + 1, fullTrack.current)} aria-label={t("nextPhoto")} className={cn(navBtn, "right-3")}>
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </>
          ) : null}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">{t("photoOf", { n: d(index + 1), total: d(total) })}</p>
        </div>
      </dialog>
    </div>
  );
}
