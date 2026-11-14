import type { ReactNode } from "react";
import "./globals.css";

/**
 * The real <html> lives in app/[locale]/layout.tsx so `lang` is correct per
 * locale. This root layout only exists so app/not-found.tsx and
 * app/global-error.tsx have a parent.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
