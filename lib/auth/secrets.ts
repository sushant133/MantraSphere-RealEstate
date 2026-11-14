import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/** Hashing helpers for OTPs, email/reset tokens and passwords. */

const pepper = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return s ?? "dev-only-secret";
};

/** 6-digit numeric code, uniformly random. */
export const newOtpCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** HMAC so a leaked DB dump cannot be brute-forced offline without the secret. */
export const hashOtp = (phone: string, code: string) => createHmac("sha256", pepper()).update(`${phone}:${code}`).digest("hex");

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** URL-safe single-use token + its hash (only the hash is stored). */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const BCRYPT_COST = 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

const COMMON = new Set(["password", "password1", "12345678", "123456789", "qwerty123", "11111111", "iloveyou", "nepal123", "admin123"]);

/** Minimum 8 chars, letters + digits, not a well-known password. Returns an error key or null. */
export function passwordProblem(pw: string): "short" | "weak" | "common" | null {
  if (pw.length < 8) return "short";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "weak";
  if (COMMON.has(pw.toLowerCase())) return "common";
  return null;
}
