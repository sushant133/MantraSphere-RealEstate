import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A simulated gateway for local development and e2e tests. It must be
 * switched on explicitly (PAYMENT_MODE=mock) and its result links are signed
 * with AUTH_SECRET, so a user cannot forge a "paid" redirect.
 */
export const mockEnabled = () => process.env.PAYMENT_MODE === "mock";

const sign = (pid: string, result: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "dev-only-secret").update(`mock:${pid}:${result}`).digest("hex");

export const mockReturnUrl = (base: string, pid: string, result: "success" | "failure") =>
  `${base}/api/payments/mock/return?pid=${pid}&result=${result}&sig=${sign(pid, result)}`;

export function mockVerify(pid: string, result: string, sig: string): boolean {
  if (!mockEnabled()) return false;
  const a = Buffer.from(sign(pid, result));
  const b = Buffer.from(sig ?? "");
  return a.length === b.length && timingSafeEqual(a, b) && result === "success";
}
