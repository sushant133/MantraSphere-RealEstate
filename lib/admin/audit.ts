import "server-only";
import { connectDB } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/request";
import { AuditLog } from "@/models";

const SECRET_KEYS = /password|token|secret|hash/i;

/** Keep only changed keys and never store secrets. */
function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before || !after) return { before: scrub(before), after: scrub(after) };
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      b[k] = before[k];
      a[k] = after[k];
    }
  }
  return { before: scrub(b), after: scrub(a) };
}

function scrub(o: Record<string, unknown> | null) {
  if (!o) return o;
  return Object.fromEntries(Object.entries(o).filter(([k]) => !SECRET_KEYS.test(k)).map(([k, v]) => [k, typeof v === "string" && v.length > 500 ? `${v.slice(0, 500)}…` : v]));
}

/** Record an admin action. Called by every admin mutation. */
export async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
) {
  await connectDB();
  const d = diff(before, after);
  await AuditLog.create({ actor: actorId, action, entity, entityId, before: d.before, after: d.after, ipHash: hashIp(await clientIp()) });
}

/** Plain JSON copy of a lean/hydrated doc for audit snapshots. */
export const snap = (doc: unknown): Record<string, unknown> | null =>
  doc ? (JSON.parse(JSON.stringify((doc as { toObject?: () => unknown }).toObject?.() ?? doc)) as Record<string, unknown>) : null;
