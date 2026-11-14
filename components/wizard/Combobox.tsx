"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { inputCls } from "@/components/forms/styles";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; hint?: string; keywords?: string };

/**
 * Searchable select following the ARIA 1.2 combobox pattern
 * (input + listbox, arrow keys, Enter, Escape). Used for the 77 districts
 * and 753 local levels (fix #25).
 */
export function Combobox({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  noMatches,
  disabled,
}: {
  id: string;
  label: string;
  options: ComboOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  noMatches: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setQuery(selected?.label ?? ""), [selected?.label]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === selected?.label.toLowerCase()) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.keywords ?? ""}`.toLowerCase().includes(q));
  }, [options, query, selected?.label]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (o: ComboOption) => {
    onChange(o.value);
    setQuery(o.label);
    setOpen(false);
  };

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            if (!e.target.value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => {
            setOpen(false);
            setQuery(selected?.label ?? "");
          }, 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && filtered[active]) {
              e.preventDefault();
              choose(filtered[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery(selected?.label ?? "");
            }
          }}
          className={cn(inputCls, "pr-10")}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
      {open && !disabled ? (
        <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{noMatches}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-sm",
                  i === active && "bg-muted",
                  o.value === value && "font-semibold text-primary",
                )}
              >
                <span>{o.label}</span>
                {o.hint ? <span className="text-xs text-muted-foreground">{o.hint}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
