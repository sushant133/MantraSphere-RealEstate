"use client";

import { Check, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleCompare, useCompareCodes } from "./compare-store";

export type CompareLabels = { compare: string; comparing: string };

/** Add/remove a listing from the comparison (max 3). Labels come from the server so any page can use it. */
export function CompareButton({ code, labels, variant = "overlay", className }: { code: string; labels: CompareLabels; variant?: "overlay" | "inline"; className?: string }) {
  const on = useCompareCodes().includes(code);
  // When the list is full, the compare bar shows (and announces) the message.
  const click = () => void toggleCompare(code);
  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={click}
        aria-pressed={on}
        className={cn(
          "tap inline-flex items-center gap-1.5 rounded-full text-sm font-semibold transition",
          variant === "overlay" ? "bg-white/95 px-3 text-foreground shadow-sm hover:bg-white" : "border px-4 hover:bg-muted",
          on && "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {on ? <Check className="size-4" aria-hidden="true" /> : <GitCompareArrows className="size-4" aria-hidden="true" />}
        {on ? labels.comparing : labels.compare}
      </button>
    </span>
  );
}
