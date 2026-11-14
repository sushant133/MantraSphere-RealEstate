import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Client IP behind Cloudflare → Nginx. Nginx must set X-Real-IP from
 * CF-Connecting-IP (see deploy config, Phase 7); we never trust the raw
 * left-most X-Forwarded-For entry alone.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "0.0.0.0"
  );
}

/** Salted hash so leads/logs never store raw IPs. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? process.env.AUTH_SECRET ?? "dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
