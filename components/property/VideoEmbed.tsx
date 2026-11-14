"use client";

import { useState } from "react";
import { Play } from "lucide-react";

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Lite YouTube embed: a thumbnail until clicked (no third-party JS on page load). */
export function VideoEmbed({ url, title, playLabel }: { url: string; title: string; playLabel: string }) {
  const id = youtubeId(url);
  const [play, setPlay] = useState(false);
  if (!id) return null;
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} aria-label={playLabel} className="group absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- third-party thumbnail, fixed size */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90" />
          <span className="absolute left-1/2 top-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-105">
            <Play className="size-7 fill-white" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
