import type { ReactNode } from "react";

/** Centered card used by every auth page. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-primary">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
