import { buildMongoFilter, filtersToQuery, parseFilters, type Filters } from "./properties/filters";

/** Pure saved-search helpers (shared by the cron job, the dashboard and unit tests). */

export const MAX_SAVED_SEARCHES = 20;
export const FREQUENCIES = ["INSTANT", "DAILY", "WEEKLY"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Canonical alert query: listing filters only, never "sold" (alerts are for new listings). */
export function canonicalAlertQuery(raw: string): string {
  const f = parseFilters(new URLSearchParams(raw));
  return filtersToQuery({ ...f, status: undefined }, { sort: "featured", view: "grid", page: 1 });
}

/** Minimum gap between alerts per frequency (a little under the period so the hourly cron doesn't drift). */
const GAP_MS: Record<Frequency, number> = { INSTANT: 50 * 60_000, DAILY: 23.5 * 3600_000, WEEKLY: 6.9 * 86_400_000 };

export function isDue(s: { frequency: Frequency; lastNotifiedAt?: Date | null; createdAt: Date }, now = new Date()): boolean {
  const last = s.lastNotifiedAt ?? s.createdAt;
  return now.getTime() - last.getTime() >= GAP_MS[s.frequency];
}

/** Mongo filter for listings that went live after `since` and match `f`. */
export function newListingsFilter(f: Filters, loc: Parameters<typeof buildMongoFilter>[1], since: Date, now = new Date()) {
  const q = buildMongoFilter({ ...f, status: undefined, within: undefined }, loc, now);
  q.status = "ACTIVE";
  q.publishedAt = { $gt: since, $lte: now };
  return q;
}
