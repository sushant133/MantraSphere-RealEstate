import type { ReactNode } from "react";

// Auth pages read the session / one-time tokens: always render per request.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
