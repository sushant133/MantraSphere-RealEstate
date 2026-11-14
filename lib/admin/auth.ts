import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Locale, Role } from "@/lib/constants";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * Admin access control. ADMIN can do everything; STAFF runs day-to-day
 * moderation and content but cannot change roles, plans, settings or read
 * the audit log. Non-staff get a 404 so the panel's existence isn't revealed.
 */
export const PERMISSIONS = {
  moderate: ["ADMIN", "STAFF"],
  listings: ["ADMIN", "STAFF"],
  leads: ["ADMIN", "STAFF"],
  content: ["ADMIN", "STAFF"],
  verify: ["ADMIN", "STAFF"],
  import: ["ADMIN", "STAFF"],
  users: ["ADMIN"],
  plans: ["ADMIN"],
  settings: ["ADMIN"],
  audit: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role, p: Permission) => (PERMISSIONS[p] as readonly Role[]).includes(role);

/** For admin pages. */
export async function requireStaff(locale: Locale, path: string, perm?: Permission): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`/${locale}/login?next=${encodeURIComponent(path)}`);
  if (u.role !== "ADMIN" && u.role !== "STAFF") notFound();
  if (perm && !can(u.role, perm)) notFound();
  return u;
}

/** For admin server actions and route handlers. */
export async function assertStaff(perm: Permission): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u || !can(u.role, perm)) throw new Error("FORBIDDEN");
  return u;
}
