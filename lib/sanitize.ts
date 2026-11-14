/**
 * Defence against NoSQL operator injection: reject any object key that
 * starts with `$` or contains `.`. Used on every untrusted payload in
 * addition to `mongoose.set("sanitizeFilter", true)` and Zod schemas.
 */
export function hasUnsafeKeys(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (Array.isArray(value)) return value.some((v) => hasUnsafeKeys(v, depth + 1));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith("$") || k.includes(".")) return true;
      if (hasUnsafeKeys(v, depth + 1)) return true;
    }
  }
  return false;
}

export function assertSafe<T>(value: T): T {
  if (hasUnsafeKeys(value)) throw new Error("Invalid input");
  return value;
}

/** Escape user text before using it inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
