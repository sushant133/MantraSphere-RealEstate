"use server";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { esc, sendEmail } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, hashIp } from "@/lib/request";
import { getSiteSettings } from "@/lib/site";
import { verifyTurnstile } from "@/lib/turnstile";
import { Lead } from "@/models";

const CONTACT_TOPICS = ["BUY", "SELL", "PAYMENT", "OTHER"] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0).optional(), // honeypot
  token: z.string().max(2048).optional(),
});

export type ContactResult = { ok: true } | { ok: false; error: "invalid" | "rate_limited" | "captcha" | "server"; fields?: string[] };

/** Contact form → a CONTACT_PAGE lead (Admin → Leads) plus an email to the office. */
export async function submitContact(input: z.input<typeof schema>): Promise<ContactResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: parsed.error.issues.map((i) => String(i.path[0])) };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: "invalid", fields: ["phone"] };

  const ip = await clientIp();
  if (!rateLimit(`contact:${ip}`, 5, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(d.token, ip))) return { ok: false, error: "captcha" };

  try {
    await connectDB();
    const message = `[${d.topic}] ${d.message}`;
    await Lead.create({ source: "CONTACT_PAGE", name: d.name, phone: phone.e164, email: d.email || undefined, message, ipHash: hashIp(ip) });
    const s = await getSiteSettings();
    await sendEmail({
      to: s.email,
      subject: `Website enquiry (${d.topic.toLowerCase()}) from ${d.name}`,
      text: `${d.name}\n${phone.e164}${d.email ? `\n${d.email}` : ""}\n\n${message}`,
      html: `<p><strong>${esc(d.name)}</strong><br>${esc(phone.e164)}${d.email ? `<br>${esc(d.email)}` : ""}</p><p style="white-space:pre-wrap">${esc(message)}</p>`,
    }).catch((e) => console.error("[contact] email failed:", (e as Error).message));
    return { ok: true };
  } catch (e) {
    console.error("[contact]", (e as Error).message);
    return { ok: false, error: "server" };
  }
}
