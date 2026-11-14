"use client";

import { useRef, useState } from "react";
import { Slider } from "radix-ui";
import { formatPriceCompact } from "@/lib/price";

/** Non-linear price steps (lakh/crore); index 0 = no min, last = no max. */
export const SALE_STEPS = [0, 5e5, 1e6, 2e6, 3e6, 5e6, 7.5e6, 1e7, 1.5e7, 2e7, 3e7, 5e7, 1e8, 2e8, -1];
export const RENT_STEPS = [0, 5e3, 1e4, 1.5e4, 2e4, 3e4, 5e4, 7.5e4, 1e5, 2e5, 5e5, -1];

const nearest = (steps: number[], v: number | undefined, fallback: number) => {
  if (v == null) return fallback;
  let best = 1;
  for (let i = 1; i < steps.length - 1; i++) if (Math.abs(steps[i] - v) < Math.abs(steps[best] - v)) best = i;
  return best;
};

/**
 * Lakh/crore price slider. Writes plain `min` / `max` hidden inputs so the
 * enclosing GET form works the same with or without JavaScript.
 */
export function PriceRange({
  form,
  rent,
  min,
  max,
  locale,
  labels,
}: {
  form: string;
  rent: boolean;
  min?: number;
  max?: number;
  locale: "en" | "ne";
  labels: { price: string; min: string; max: string; noMin: string; noMax: string };
}) {
  const steps = rent ? RENT_STEPS : SALE_STEPS;
  const last = steps.length - 1;
  const [range, setRange] = useState<[number, number]>([nearest(steps, min, 0), nearest(steps, max, last)]);
  const minRef = useRef<HTMLInputElement>(null);

  const fmt = (i: number, end: "min" | "max") =>
    i === 0 && end === "min" ? labels.noMin : i === last && end === "max" ? labels.noMax : formatPriceCompact(steps[i], locale);
  const minVal = range[0] === 0 ? "" : String(steps[range[0]]);
  const maxVal = range[1] === last ? "" : String(steps[range[1]]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${form}-price-label`} className="text-sm font-semibold">
          {labels.price}
        </span>
        <span className="text-sm font-medium text-price" aria-live="polite">
          {fmt(range[0], "min")} – {fmt(range[1], "max")}
        </span>
      </div>
      <Slider.Root
        className="relative mt-3 flex h-11 w-full touch-none select-none items-center"
        min={0}
        max={last}
        step={1}
        minStepsBetweenThumbs={1}
        value={range}
        onValueChange={(v) => setRange([v[0], v[1]])}
        onValueCommit={() => {
          // Let the hidden inputs update first, then ask the form to apply.
          requestAnimationFrame(() => minRef.current?.dispatchEvent(new Event("msr:apply", { bubbles: true })));
        }}
        aria-labelledby={`${form}-price-label`}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-muted">
          <Slider.Range className="absolute h-full rounded-full bg-primary" />
        </Slider.Track>
        {(["min", "max"] as const).map((end, i) => (
          <Slider.Thumb
            key={end}
            aria-label={end === "min" ? labels.min : labels.max}
            aria-valuetext={fmt(range[i], end)}
            className="relative block size-6 rounded-full border-2 border-primary bg-background shadow before:absolute before:-inset-2.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        ))}
      </Slider.Root>
      <input ref={minRef} type="hidden" name="min" form={form} value={minVal} />
      <input type="hidden" name="max" form={form} value={maxVal} />
    </div>
  );
}
