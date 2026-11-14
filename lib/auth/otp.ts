import "server-only";
import { connectDB } from "@/lib/db";
import { sendSms } from "@/lib/messaging";
import { rateLimit } from "@/lib/rate-limit";
import { Otp } from "@/models";
import { hashOtp, newOtpCode, safeEqualHex } from "./secrets";

const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

export type OtpRequestResult = { ok: true } | { ok: false; error: "rate_limited" | "send_failed" };

/** Create a new code for the phone (replacing older ones) and send it by SMS. */
export async function requestOtp(phoneE164: string, ip: string, locale: "en" | "ne"): Promise<OtpRequestResult> {
  if (!rateLimit(`otp:phone:${phoneE164}`, 3, 15 * 60_000).ok) return { ok: false, error: "rate_limited" };
  if (!rateLimit(`otp:ip:${ip}`, 10, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };

  await connectDB();
  const code = newOtpCode();
  await Otp.deleteMany({ phone: phoneE164 });
  await Otp.create({ phone: phoneE164, codeHash: hashOtp(phoneE164, code), expiresAt: new Date(Date.now() + TTL_MS) });

  const text =
    locale === "ne"
      ? `मन्त्रास्फियर: तपाईंको लग इन कोड ${code} हो। ५ मिनेटमा म्याद सकिन्छ। कसैलाई नदिनुहोस्।`
      : `MantraSphere: your login code is ${code}. It expires in 5 minutes. Never share it.`;
  try {
    await sendSms(phoneE164, text);
    return { ok: true };
  } catch (e) {
    console.error("[otp] send failed:", (e as Error).message);
    return { ok: false, error: "send_failed" };
  }
}

/** Check a code. Single use; locked after 5 wrong attempts. */
export async function verifyOtp(phoneE164: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  await connectDB();
  const otp = await Otp.findOne({ phone: phoneE164 }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt.getTime() < Date.now() || otp.attempts >= MAX_ATTEMPTS) return false;
  if (!safeEqualHex(otp.codeHash, hashOtp(phoneE164, code))) {
    otp.attempts += 1;
    await otp.save();
    return false;
  }
  await Otp.deleteMany({ phone: phoneE164 });
  return true;
}
