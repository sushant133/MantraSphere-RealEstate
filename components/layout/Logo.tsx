import { cn } from "@/lib/utils";

/** Original MantraSphere mark: a roofline under a rising sphere. Pure SVG, no image request. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={cn("size-9 shrink-0", className)}>
      <rect width="40" height="40" rx="10" fill="var(--color-navy-800)" />
      <circle cx="20" cy="14.5" r="5" fill="var(--color-saffron)" />
      <path
        d="M8 29.5 20 19l12 10.5"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 31.5v-5.2M26 31.5v-5.2" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ name, className, latin = true }: { name: { primary: string; secondary: string }; className?: string; latin?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[1.05rem] font-bold tracking-tight text-primary">{name.primary}</span>
        <span className={cn("mt-1 font-semibold text-muted-foreground", latin ? "text-[0.65rem] uppercase tracking-[0.18em]" : "text-xs")}>
          {name.secondary}
        </span>
      </span>
    </span>
  );
}
