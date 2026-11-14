import mongoose from "mongoose";

/**
 * Single cached Mongoose connection that survives Next.js hot reloads
 * (the module is re-evaluated, but `globalThis` is not).
 */

// Reject `$`-prefixed operators smuggled in through query filters.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = g.__mongoose ?? (g.__mongoose = { conn: null, promise: null });

export async function connectDB(uri = process.env.MONGODB_URI): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.");
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      // Overrides the database in the URI path (Atlas URIs often have none).
      ...(process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {}),
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      // Indexes are built by `npm run db:sync-indexes`, not on every boot.
      autoIndex: process.env.NODE_ENV !== "production",
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}

export async function disconnectDB() {
  if (cache.conn) await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}

/**
 * `sanitizeFilter` turns any `$operator` object in a filter into a literal
 * `$eq` match. Server-built filters that need operators must be wrapped:
 * `Property.find({ priceNpr: trusted({ $gte: min }) })`. Never wrap user input.
 */
export const trusted = <T>(obj: T): T => mongoose.trusted(obj) as T;

/**
 * Mongoose rejects `$text` whenever the global sanitizeFilter is on (the
 * global setting overrides per-query options), so text search runs on the
 * native driver collection: `Property.collection.find({ ...textSearch(q), status: "ACTIVE" })`.
 * Safe because `q` is coerced to a plain, length-limited string here — it
 * can never carry an operator object.
 */
export function textSearch(q: unknown): { $text: { $search: string } } {
  const s = String(q ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, 100).trim();
  return { $text: { $search: s } };
}
