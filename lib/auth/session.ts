import "server-only";
import { redirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import type { Locale, Role } from "@/lib/constants";
import { auth } from "./index";

export type SessionUser = { id: string; role: Role; name?: string | null; email?: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const s = await auth();
  return s?.user?.id ? { id: s.user.id, role: s.user.role, name: s.user.name, email: s.user.email } : null;
}

/** For pages: redirect to the localized login with a safe `next` back-link. */
export async function requireUser(locale: Locale, next: string): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(safeNext(next, locale))}`);
  return u;
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function assertUser(roles?: Role[]): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  if (roles && !roles.includes(u.role)) throw new Error("FORBIDDEN");
  return u;
}

/** Only same-site, locale-prefixed paths are allowed as post-login targets (no open redirects). */
export function safeNext(next: string | null | undefined, locale: Locale): string {
  if (next && /^\/(en|ne)(\/[A-Za-z0-9\-_/?=&%.]*)?$/.test(next) && !next.startsWith("//")) return next;
  return `/${locale}/dashboard`;
}
