import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * SMS (Sparrow / Aakash) and email (Resend / SMTP).
 *
 * The `outbox` driver writes messages as JSON files to ./.outbox/{sms,email}
 * instead of sending them. It exists for local development and e2e tests and
 * must be selected explicitly (SMS_PROVIDER=outbox, EMAIL_PROVIDER=outbox);
 * it is never a silent fallback. With no provider configured, sending throws
 * in production and logs to the console in development.
 */

type SmsProvider = "sparrow" | "aakash" | "outbox";
type EmailProvider = "resend" | "smtp" | "outbox";

const OUTBOX = path.join(process.cwd(), ".outbox");

async function toOutbox(kind: "sms" | "email", payload: Record<string, unknown>) {
  const dir = path.join(OUTBOX, kind);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  await fs.writeFile(file, JSON.stringify({ ...payload, at: new Date().toISOString() }, null, 2));
  if (process.env.NODE_ENV === "production") console.warn(`[messaging] OUTBOX driver active in production (${kind})`);
}

function smsProvider(): SmsProvider | null {
  const p = process.env.SMS_PROVIDER as SmsProvider | undefined;
  if (p === "outbox") return p;
  if (p === "sparrow" && process.env.SPARROW_SMS_TOKEN) return p;
  if (p === "aakash" && process.env.AAKASH_SMS_TOKEN) return p;
  return null;
}

/** Send an SMS to a Nepali mobile in E.164 (+9779XXXXXXXXX). */
export async function sendSms(toE164: string, text: string): Promise<void> {
  const provider = smsProvider();
  const local = toE164.replace(/^\+977/, ""); // both gateways expect the 10-digit local number
  if (provider === "outbox") return toOutbox("sms", { to: toE164, text });
  if (provider === "sparrow") {
    const res = await fetch("https://api.sparrowsms.com/v2/sms/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: process.env.SPARROW_SMS_TOKEN!, from: process.env.SPARROW_SMS_FROM ?? "", to: local, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Sparrow SMS failed: ${res.status}`);
    return;
  }
  if (provider === "aakash") {
    const res = await fetch("https://sms.aakashsms.com/sms/v3/send", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ auth_token: process.env.AAKASH_SMS_TOKEN!, to: local, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Aakash SMS failed: ${res.status}`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("No SMS provider configured");
  console.info(`[sms:dev] to ${toE164}: ${text}`);
}

function emailProvider(): EmailProvider | null {
  const p = process.env.EMAIL_PROVIDER as EmailProvider | undefined;
  if (p === "outbox") return p;
  if ((p === "resend" || !p) && process.env.RESEND_API_KEY) return "resend";
  if ((p === "smtp" || !p) && process.env.SMTP_HOST) return "smtp";
  return null;
}

export type Email = { to: string; subject: string; text: string; html?: string };

export async function sendEmail(mail: Email): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "MantraSphere Real Estate <info@mantrasphere.com.np>";
  const provider = emailProvider();
  if (provider === "outbox") return toOutbox("email", { from, ...mail });
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
    return;
  }
  if (provider === "smtp") {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({ from, ...mail });
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("No email provider configured");
  console.info(`[email:dev] to ${mail.to}: ${mail.subject}\n${mail.text}`);
}

/** Minimal escaping for values placed into HTML emails. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
