"use client";

import { useSyncExternalStore } from "react";

/** Up to three listing codes picked for side-by-side comparison (this device only). */
export const COMPARE_MAX = 3;
const KEY = "msr:compare";
const EVENT = "msr:compare-change";
export const FULL_EVENT = "msr:compare-full";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^MSR-\d{6,}$/.test(x)).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCompareCodes(): string[] {
  const s = useSyncExternalStore(subscribe, () => read().join(","), () => "");
  return s ? s.split(",") : [];
}

/** Returns false when the list is already full. */
export function toggleCompare(code: string): boolean {
  const list = read();
  if (list.includes(code)) {
    write(list.filter((c) => c !== code));
    return true;
  }
  if (list.length >= COMPARE_MAX) {
    window.dispatchEvent(new Event(FULL_EVENT)); // the compare bar announces it
    return false;
  }
  write([...list, code]);
  return true;
}

export function removeCompare(code: string) {
  write(read().filter((c) => c !== code));
}

export function clearCompare() {
  write([]);
}
