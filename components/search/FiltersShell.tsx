"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Progressive enhancement for the single server-rendered filter <form>
 * (fix #11: one search component, no duplicated markup):
 * - without JS it is a plain GET form;
 * - with JS every change applies instantly via soft navigation;
 * - below `lg` the same markup is shown as a bottom sheet.
 */

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const FiltersCtx = createContext<Ctx>({ open: false, setOpen: () => {} });

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <FiltersCtx.Provider value={{ open, setOpen }}>{children}</FiltersCtx.Provider>;
}

export function FilterToggle({ label, count }: { label: string; count: number }) {
  const { setOpen } = useContext(FiltersCtx);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-controls="filters-panel"
      className="tap inline-flex items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold lg:hidden"
    >
      <SlidersHorizontal className="size-4" aria-hidden="true" />
      {label}
      {count > 0 ? (
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{count}</span>
      ) : null}
    </button>
  );
}

export function FiltersPanel({
  formId,
  title,
  closeLabel,
  showResultsLabel,
  children,
}: {
  formId: string;
  title: string;
  closeLabel: string;
  showResultsLabel: string;
  children: ReactNode;
}) {
  const { open, setOpen } = useContext(FiltersCtx);
  const router = useRouter();
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  const apply = useCallback(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      if (typeof v === "string" && v.trim() !== "" && k !== "page") params.set(k, v.trim());
    }
    const target = new URL(form.action, window.location.href).pathname;
    const qs = params.toString();
    router.push(`${target}${qs ? `?${qs}` : ""}`, { scroll: target !== pathname });
  }, [formId, router, pathname]);

  useEffect(() => {
    const belongs = (el: EventTarget | null) =>
      el instanceof HTMLElement && "form" in el && (el as HTMLInputElement).form?.id === formId;
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!belongs(el)) return;
      if (el.type === "search" || el.type === "number") return; // applied on submit/blur below
      apply();
    };
    const onCommit = (e: Event) => belongs(e.target) && apply();
    const onSubmit = (e: Event) => {
      if ((e.target as HTMLFormElement).id !== formId) return;
      e.preventDefault();
      apply();
      setOpen(false);
    };
    const onBlur = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement;
      if (belongs(el) && el.type === "number" && el.defaultValue !== el.value) apply();
    };
    document.addEventListener("change", onChange);
    document.addEventListener("msr:apply", onCommit);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("change", onChange);
      document.removeEventListener("msr:apply", onCommit);
      document.removeEventListener("submit", onSubmit);
      document.removeEventListener("focusout", onBlur);
    };
  }, [apply, formId, setOpen]);

  // Mobile sheet: Esc to close, lock background scroll, move focus in.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <>
      {open ? <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <div
        id="filters-panel"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={title}
        className={cn(
          "lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:rounded-2xl lg:border lg:bg-card lg:p-5",
          open
            ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-background shadow-2xl lg:static lg:z-auto lg:max-h-none lg:shadow-none"
            : "hidden",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-2 lg:hidden">
          <p className="text-base font-semibold">{title}</p>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={closeLabel} className="tap inline-flex items-center justify-center rounded-full hover:bg-muted">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 lg:p-0">{children}</div>
        <div className="safe-bottom border-t p-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tap w-full rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
          >
            {showResultsLabel}
          </button>
        </div>
      </div>
    </>
  );
}
