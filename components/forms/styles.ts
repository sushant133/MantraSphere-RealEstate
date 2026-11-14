/** Shared form control classes (44 px tap targets, visible focus, error state). */
export const inputCls =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-60";
export const selectCls = inputCls;
export const textareaCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";
export const labelCls = "text-sm font-semibold";
export const primaryBtn =
  "tap inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
export const accentBtn =
  "tap inline-flex items-center justify-center gap-2 rounded-xl bg-saffron px-5 text-base font-semibold text-saffron-foreground hover:bg-saffron/90 disabled:opacity-60";
export const outlineBtn =
  "tap inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-5 text-base font-semibold hover:bg-muted disabled:opacity-60";
export const linkCls = "font-semibold text-primary underline-offset-4 hover:underline";
