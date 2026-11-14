/**
 * Khalti ePayment (KPG-2). We create a payment server-side, redirect to
 * Khalti's hosted page, and on return confirm with the lookup API.
 * Amounts are in paisa.
 */

const BASE = { test: "https://dev.khalti.com/api/v2", live: "https://khalti.com/api/v2" };

export function khaltiConfig() {
  const live = process.env.KHALTI_ENV === "live";
  const key = process.env.KHALTI_SECRET_KEY ?? "";
  return { enabled: !!key, live, key, base: live ? BASE.live : BASE.test };
}

export async function khaltiInitiate(p: {
  orderId: string;
  orderName: string;
  amountNpr: number;
  returnUrl: string;
  websiteUrl: string;
  customer?: { name?: string; email?: string; phone?: string };
}): Promise<{ pidx: string; paymentUrl: string }> {
  const c = khaltiConfig();
  const res = await fetch(`${c.base}/epayment/initiate/`, {
    method: "POST",
    headers: { Authorization: `Key ${c.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      return_url: p.returnUrl,
      website_url: p.websiteUrl,
      amount: p.amountNpr * 100,
      purchase_order_id: p.orderId,
      purchase_order_name: p.orderName.slice(0, 100),
      customer_info: p.customer,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const d = (await res.json().catch(() => null)) as { pidx?: string; payment_url?: string } | null;
  if (!res.ok || !d?.pidx || !d.payment_url) throw new Error(`Khalti initiate failed (${res.status})`);
  return { pidx: d.pidx, paymentUrl: d.payment_url };
}

export async function khaltiLookup(pidx: string, amountNpr: number): Promise<{ ok: boolean; status: string; txnId?: string; raw: unknown }> {
  const c = khaltiConfig();
  const res = await fetch(`${c.base}/epayment/lookup/`, {
    method: "POST",
    headers: { Authorization: `Key ${c.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pidx }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const raw = (await res.json().catch(() => null)) as { status?: string; total_amount?: number; transaction_id?: string } | null;
  const status = raw?.status ?? "UNKNOWN";
  return { ok: status === "Completed" && Number(raw?.total_amount) === amountNpr * 100, status, txnId: raw?.transaction_id ?? undefined, raw };
}
