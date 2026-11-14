"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Holds the latest Turnstile token and lets a submit handler wait briefly
 * for it (the invisible challenge may still be running when the user taps
 * "Send" on a slow connection).
 */
export function useTurnstileToken(siteKey: string) {
  const ref = useRef("");
  const [, force] = useState(0);
  const onToken = useCallback((t: string) => {
    ref.current = t;
    force((n) => n + 1);
  }, []);
  const waitForToken = useCallback(
    async (timeoutMs = 10_000): Promise<string> => {
      if (!siteKey) return "";
      const start = Date.now();
      while (!ref.current && Date.now() - start < timeoutMs) await new Promise((r) => setTimeout(r, 150));
      return ref.current;
    },
    [siteKey],
  );
  return { onToken, waitForToken };
}
