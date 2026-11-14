import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * eSewa ePay v2. The browser POSTs a signed form to eSewa; on return we
 * verify eSewa's signature AND ask eSewa's status API (never trust the
 * redirect alone).
 */

const TEST = { form: "https://rc-epay.esewa.com.np/api/epay/main/v2/form", status: "https://rc.esewa.com.np/api/epay/transaction/status/", code: "EPAYTEST", secret: "8gBm/:&EnhH.1/q" };
const LIVE = { form: "https://epay.esewa.com.np/api/epay/main/v2/form", status: "https://epay.esewa.com.np/api/epay/transaction/status/" };

export function esewaConfig() {
  const live = process.env.ESEWA_ENV === "live";
  const code = process.env.ESEWA_MERCHANT_CODE || (live ? "" : TEST.code);
  const secret = process.env.ESEWA_SECRET_KEY || (live ? "" : TEST.secret);
  return { enabled: !!(code && secret) && process.env.ESEWA_DISABLED !== "1", live, code, secret, ...(live ? LIVE : TEST) };
}

export function esewaSign(fields: Record<string, string>, names: string[], secret: string): string {
  const msg = names.map((n) => `${n}=${fields[n]}`).join(",");
  return createHmac("sha256", secret).update(msg).digest("base64");
}

/** Fields for the auto-submitted form. Amounts are whole rupees. */
export function esewaForm(p: { uuid: string; amountNpr: number; successUrl: string; failureUrl: string }) {
  const c = esewaConfig();
  const fields: Record<string, string> = {
    amount: String(p.amountNpr),
    tax_amount: "0",
    total_amount: String(p.amountNpr),
    transaction_uuid: p.uuid,
    product_code: c.code,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: p.successUrl,
    failure_url: p.failureUrl,
    signed_field_names: "total_amount,transaction_uuid,product_code",
  };
  fields.signature = esewaSign(fields, ["total_amount", "transaction_uuid", "product_code"], c.secret);
  return { action: c.form, fields };
}

export type EsewaResult = { ok: boolean; status: string; refId?: string; raw: unknown };

/** Decode + verify the `data` param eSewa appends to success_url. */
export function esewaDecode(data: string): Record<string, string> | null {
  try {
    const obj = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as Record<string, string>;
    const c = esewaConfig();
    const names = String(obj.signed_field_names ?? "").split(",").filter(Boolean);
    if (!names.length || !obj.signature) return null;
    const expected = Buffer.from(esewaSign(Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)])), names, c.secret));
    const got = Buffer.from(String(obj.signature));
    return expected.length === got.length && timingSafeEqual(expected, got) ? obj : null;
  } catch {
    return null;
  }
}

/** Server-to-server status check — the source of truth. */
export async function esewaStatus(uuid: string, amountNpr: number): Promise<EsewaResult> {
  const c = esewaConfig();
  const url = `${c.status}?product_code=${encodeURIComponent(c.code)}&total_amount=${amountNpr}&transaction_uuid=${encodeURIComponent(uuid)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const raw = (await res.json().catch(() => null)) as { status?: string; ref_id?: string; total_amount?: number } | null;
  const status = raw?.status ?? "UNKNOWN";
  return { ok: status === "COMPLETE" && Number(raw?.total_amount) === amountNpr, status, refId: raw?.ref_id ?? undefined, raw };
}
