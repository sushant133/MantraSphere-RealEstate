"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PropertyCard } from "@/components/property/PropertyCard";
import type { PropertyCardDTO } from "@/lib/properties/dto";
import { cn } from "@/lib/utils";

type Page = { items: PropertyCardDTO[]; nextCursor: string | null; page: number; pages: number };

/**
 * Appends further result pages below the server-rendered first page.
 * Uses the keyset cursor when the API returns one (cursor-based infinite
 * scroll), otherwise ?page=N. The URL is kept in sync (?page=N) so the
 * position can be shared, and server-rendered pagination is hidden.
 */
export function InfiniteList({
  query,
  page,
  pages,
  cursor,
  variant,
  gridClassName,
}: {
  query: string;
  page: number;
  pages: number;
  cursor: string | null;
  variant: "grid" | "list";
  gridClassName: string;
}) {
  const t = useTranslations("search");
  const [items, setItems] = useState<PropertyCardDTO[]>([]);
  const [state, setState] = useState({ page, cursor, pages, loading: false, error: false, autoLoads: 0 });
  const sentinel = useRef<HTMLDivElement>(null);
  const done = state.page >= state.pages;

  useEffect(() => {
    if (pages > 1) document.getElementById("pagination")?.setAttribute("hidden", "");
  }, [pages]);

  const load = useCallback(async () => {
    if (state.loading || done) return;
    setState((s) => ({ ...s, loading: true, error: false }));
    const next = state.page + 1;
    const qs = new URLSearchParams(query);
    if (state.cursor) qs.set("cursor", state.cursor);
    else qs.set("page", String(next));
    try {
      const res = await fetch(`/api/properties?${qs}`, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Page;
      setItems((prev) => [...prev, ...data.items]);
      setState((s) => ({ ...s, page: next, cursor: data.nextCursor, pages: data.pages || s.pages, loading: false, autoLoads: s.autoLoads + 1 }));
      const url = new URL(window.location.href);
      url.searchParams.set("page", String(next));
      window.history.replaceState(window.history.state, "", url);
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, [state.loading, state.page, state.cursor, done, query]);

  // Auto-load the next 3 pages as the user nears the end, then switch to a button.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || state.autoLoads >= 3 || state.error) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && load(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load, done, state.autoLoads, state.error]);

  if (pages <= page) return null;

  return (
    <>
      {items.length ? (
        <ul className={cn(gridClassName, "mt-5")}>
          {items.map((p) => (
            <li key={p.id} className="flex">
              <PropertyCard p={p} variant={variant} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={sentinel} className="mt-8 flex flex-col items-center gap-2" aria-live="polite">
        {state.loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
        {state.error ? <p className="text-sm text-destructive">{t("loadError")}</p> : null}
        {!done && !state.loading && (state.autoLoads >= 3 || state.error) ? (
          <button type="button" onClick={load} className="tap rounded-xl border px-6 text-sm font-semibold hover:bg-muted">
            {t("loadMore")}
          </button>
        ) : null}
      </div>
    </>
  );
}
