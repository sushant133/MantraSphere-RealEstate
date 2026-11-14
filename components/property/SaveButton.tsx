"use client";

import { useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Saved properties on this device (localStorage), with optimistic UI. When
 * the visitor is logged in, the list is merged with their account
 * (/api/me/saved) and each toggle is mirrored there.
 */
const KEY = "msr:saved";
const EVENT = "msr:saved-change";
const ACCOUNT_FLAG = "msr:saved-acct"; // set after a successful sync while logged in

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 200) : [];
  } catch {
    return [];
  }
}

let cache: string[] | null = null;
function snapshot(): string {
  cache = read();
  return cache.join(",");
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSavedCodes(): string[] {
  const s = useSyncExternalStore(subscribe, snapshot, () => "");
  return s ? s.split(",") : [];
}

function store(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* storage full or blocked: ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

function flag(on?: boolean): boolean {
  try {
    if (on === true) localStorage.setItem(ACCOUNT_FLAG, "1");
    if (on === false) localStorage.removeItem(ACCOUNT_FLAG);
    return localStorage.getItem(ACCOUNT_FLAG) === "1";
  } catch {
    return false;
  }
}

async function post(body: object): Promise<string[] | null> {
  const res = await fetch("/api/me/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res?.ok) return null;
  const { codes } = (await res.json()) as { codes: string[] | null };
  flag(codes !== null); // null = logged out
  return codes;
}

/** Merge this device's list with the account (no-op when logged out). */
export async function syncSaved(): Promise<void> {
  const codes = await post({ merge: read() });
  if (codes) store([...new Set([...read(), ...codes])]);
}

export function toggleSaved(code: string) {
  const list = read();
  const removing = list.includes(code);
  store(removing ? list.filter((c) => c !== code) : [code, ...list]);
  if (flag()) void post(removing ? { remove: code } : { add: code });
}

export function SaveButton({
  code,
  labels,
  className,
}: {
  code: string;
  labels: { save: string; unsave: string };
  className?: string;
}) {
  const saved = useSavedCodes().includes(code);
  return (
    <button
      type="button"
      onClick={() => toggleSaved(code)}
      aria-pressed={saved}
      aria-label={saved ? labels.unsave : labels.save}
      title={saved ? labels.unsave : labels.save}
      className={cn(
        "tap inline-flex items-center justify-center rounded-full bg-white/95 text-foreground shadow-sm transition hover:scale-105",
        className,
      )}
    >
      <Heart className={cn("size-5", saved ? "fill-red-500 text-red-500" : "text-foreground/80")} aria-hidden="true" />
    </button>
  );
}
