import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Sends only the listed message namespaces to the browser for this subtree
 * (instead of the whole dictionary on every page). Nested providers replace,
 * not merge, so list every namespace the client components below need.
 */
export async function IntlScope({ namespaces, children }: { namespaces: string[]; children: ReactNode }) {
  const all = (await getMessages()) as Record<string, unknown>;
  const messages = Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]]));
  return <NextIntlClientProvider messages={messages as never}>{children}</NextIntlClientProvider>;
}
