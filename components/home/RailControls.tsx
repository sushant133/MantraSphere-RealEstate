"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous/next buttons for a horizontal card rail. Hidden when everything fits. */
export function RailControls({ railId, labels }: { railId: string; labels: { prev: string; next: string } }) {
  const [state, setState] = useState({ overflow: false, start: true, end: false });

  useEffect(() => {
    const el = document.getElementById(railId);
    if (!el) return;
    const update = () =>
      setState({
        overflow: el.scrollWidth > el.clientWidth + 4,
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [railId]);

  if (!state.overflow) return null;
  const go = (dir: 1 | -1) => {
    const el = document.getElementById(railId);
    el?.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };
  const btn =
    "tap inline-flex items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition hover:bg-muted disabled:cursor-default disabled:opacity-40 disabled:hover:bg-card";
  return (
    <div className="hidden gap-2 sm:flex">
      <button type="button" className={btn} onClick={() => go(-1)} disabled={state.start} aria-controls={railId} aria-label={labels.prev}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onClick={() => go(1)} disabled={state.end} aria-controls={railId} aria-label={labels.next}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
