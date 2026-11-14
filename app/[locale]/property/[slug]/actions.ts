"use server";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, hashIp } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";
import { notifyNewLead } from "@/lib/notify";
import { Lead, Property, Report } from "@/models";

/**
 * Server Actions for the listing page. Next.js checks the Origin header on
 * every action (built-in CSRF protection, fix #11). All input is re-validated
 * here with Zod, rate-limited per IP, and spam-checked (honeypot + Turnstile).
 */

const code = z.string().regex(/^MSR-\d{6,}$/);

// ---- Show number / call / WhatsApp / Viber ----------------------------------

const revealSchema = z.object({ code, channel: z.enum(["SHOW_NUMBER", "CALL", "WHATSAPP", "VIBER"]) });

export type RevealResult =
  | { ok: true; phone: string; whatsapp: string | null; viber: string | null }
  | { ok: false; error: "rate_limited" | "not_found" | "invalid" };

export async function revealContact(input: z.input<typeof revealSchema>): Promise<RevealResult> {
  const parsed = revealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const ip = await clientIp();
  if (!rateLimit(`reveal:${ip}`, 30, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };

  await connectDB();
  const p = await Property.findOne({ code: parsed.data.code, status: "ACTIVE" })
    .select("_id code owner contactPhone whatsapp viber")
    .lean();
  if (!p?.contactPhone) return { ok: false, error: "not_found" };

  // One logged lead per visitor, listing and channel per day.
  if (rateLimit(`reveal-lead:${ip}:${p.code}:${parsed.data.channel}`, 1, 24 * 60 * 60_000).ok) {
    await Lead.create({ property: p._id, propertyCode: p.code, owner: p.owner, source: parsed.data.channel, ipHash: hashIp(ip) });
    await Property.updateOne({ _id: p._id }, { $inc: { leadsCount: 1 } });
  }
  return { ok: true, phone: p.contactPhone, whatsapp: p.whatsapp ?? p.contactPhone, viber: p.viber ?? null };
}

// ---- Enquiry form --------------------------------------------------------------

const enquirySchema = z.object({
  code,
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).optional(),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0).optional(), // honeypot: must stay empty
  token: z.string().max(2048).optional(),
});

export type FormResult = { ok: true } | { ok: false; error: "invalid" | "rate_limited" | "captcha" | "not_found" | "server"; fields?: string[] };

export async function submitEnquiry(input: z.input<typeof enquirySchema>): Promise<FormResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: parsed.error.issues.map((i) => String(i.path[0])) };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone || phone.kind !== "MOBILE") return { ok: false, error: "invalid", fields: ["phone"] };

  const ip = await clientIp();
  if (!rateLimit(`enquiry:${ip}`, 5, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(d.token, ip))) return { ok: false, error: "captcha" };

  try {
    await connectDB();
    const p = await Property.findOne({ code: d.code, status: "ACTIVE" }).select("_id code owner").lean();
    if (!p) return { ok: false, error: "not_found" };
    await Lead.create({
      property: p._id,
      propertyCode: p.code,
      owner: p.owner,
      source: "ENQUIRY_FORM",
      name: d.name,
      phone: phone.e164,
      email: d.email || undefined,
      message: d.message,
      ipHash: hashIp(ip),
    });
    await Property.updateOne({ _id: p._id }, { $inc: { leadsCount: 1 } });
    await notifyNewLead({ ownerId: String(p.owner), code: p.code, name: d.name, phone: phone.e164, message: d.message });
    return { ok: true };
  } catch (e) {
    console.error("[enquiry]", (e as Error).message);
    return { ok: false, error: "server" };
  }
}

// ---- Report listing ------------------------------------------------------------

const reportSchema = z.object({
  code,
  reason: z.enum(["SOLD", "WRONG_INFO", "DUPLICATE", "FRAUD", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
  website: z.string().max(0).optional(),
  token: z.string().max(2048).optional(),
});

export async function submitReport(input: z.input<typeof reportSchema>): Promise<FormResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const ip = await clientIp();
  if (!rateLimit(`report:${ip}`, 5, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(parsed.data.token, ip))) return { ok: false, error: "captcha" };
  await connectDB();
  const p = await Property.findOne({ code: parsed.data.code }).select("_id").lean();
  if (!p) return { ok: false, error: "not_found" };
  await Report.create({ property: p._id, reason: parsed.data.reason, details: parsed.data.details });
  return { ok: true };
}
