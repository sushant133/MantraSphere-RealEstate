"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during SSR and until React has hydrated. Buttons whose only behaviour
 * comes from JS (payments, submit) stay disabled until then, so an early tap
 * on a slow phone isn't silently lost.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
