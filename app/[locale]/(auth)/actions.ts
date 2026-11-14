"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { requestOtp } from "@/lib/auth/otp";
import { hashPassword, hashToken, newToken, passwordProblem } from "@/lib/auth/secrets";
import { safeNext } from "@/lib/auth/session";
import { connectDB, trusted } from "@/lib/db";
import { esc, sendEmail } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { absoluteUrl } from "@/lib/seo";
import { verifyTurnstile } from "@/lib/turnstile";
import { AuthToken, User } from "@/models";

type Locale = "en" | "ne";
const locale = z.enum(["en", "ne"]).catch("en");
export type ActionResult = { ok: true; phone?: string } | { ok: false; error: string };

// ---- Phone OTP ----------------------------------------------------------------

export async function sendLoginCode(input: { phone: string; token?: string; locale: Locale }): Promise<ActionResult> {
  const phone = normalizePhone(String(input.phone ?? ""));
  if (!phone || phone.kind !== "MOBILE") return { ok: false, error: "invalid_phone" };
  const ip = await clientIp();
  if (!(await verifyTurnstile(input.token, ip))) return { ok: false, error: "captcha" };
  const r = await requestOtp(phone.e164, ip, locale.parse(input.locale));
  return r.ok ? { ok: true, phone: phone.e164 } : { ok: false, error: r.error };
}

async function credentialSignIn(provider: string, fields: Record<string, string>, next: string, loc: Locale): Promise<ActionResult> {
  try {
    await signIn(provider, { ...fields, redirectTo: safeNext(next, loc) });
    return { ok: true };
  } catch (e) {
    if (e instanceof CredentialsSignin) return { ok: false, error: e.code || "invalid_credentials" };
    if (e instanceof AuthError) return { ok: false, error: "server" };
    throw e; // NEXT_REDIRECT on success
  }
}

export async function verifyLoginCode(input: { phone: string; code: string; next: string; locale: Locale }): Promise<ActionResult> {
  const loc = locale.parse(input.locale);
  const code = String(input.code ?? "").replace(/\D/g, "").slice(0, 6);
  return credentialSignIn("phone-otp", { phone: String(input.phone ?? ""), code, locale: loc }, input.next, loc);
}

// ---- Email + password -----------------------------------------------------------

export async function passwordLogin(input: { email: string; password: string; next: string; locale: Locale }): Promise<ActionResult> {
  const loc = locale.parse(input.locale);
  return credentialSignIn("password", { email: String(input.email ?? ""), password: String(input.password ?? "") }, input.next, loc);
}

export async function googleLogin(next: string, loc: Locale) {
  await signIn("google", { redirectTo: safeNext(next, locale.parse(loc)) });
}

export async function logout(loc: Locale) {
  await signOut({ redirectTo: `/${locale.parse(loc)}` });
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(200),
  accept: z.boolean().refine((v) => v === true),
  website: z.string().max(0).optional(),
  token: z.string().max(2048).optional(),
  locale,
});

async function sendVerifyEmail(userId: string, email: string, name: string, loc: Locale) {
  await AuthToken.deleteMany({ user: userId, kind: "EMAIL_VERIFY" });
  const { token, hash } = newToken();
  await AuthToken.create({ kind: "EMAIL_VERIFY", user: userId, tokenHash: hash, expiresAt: new Date(Date.now() + 24 * 3600_000) });
  const link = `${absoluteUrl(loc, "/verify-email")}?token=${token}`;
  const ne = loc === "ne";
  await sendEmail({
    to: email,
    subject: ne ? "आफ्नो इमेल प्रमाणित गर्नुहोस् – मन्त्रास्फियर" : "Verify your email – MantraSphere Real Estate",
    text: `${ne ? "नमस्ते" : "Hello"} ${name},\n\n${ne ? "खाता सक्रिय गर्न यो लिंक खोल्नुहोस् (२४ घण्टाभित्र):" : "Open this link within 24 hours to activate your account:"}\n${link}\n\n${ne ? "तपाईंले दर्ता गर्नुभएको होइन भने यो इमेल बेवास्ता गर्नुहोस्।" : "If you didn't sign up, ignore this email."}`,
    html: `<p>${ne ? "नमस्ते" : "Hello"} ${esc(name)},</p><p><a href="${esc(link)}">${ne ? "इमेल प्रमाणित गर्नुहोस्" : "Verify my email"}</a></p><p style="color:#666">${ne ? "२४ घण्टाभित्र प्रयोग गर्नुहोस्।" : "This link expires in 24 hours."}</p>`,
  });
}

/** Always answers "check your email" so the form cannot be used to discover accounts. */
export async function register(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;
  const problem = passwordProblem(d.password);
  if (problem) return { ok: false, error: `password_${problem}` };
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(d.token, ip))) return { ok: false, error: "captcha" };

  await connectDB();
  const existing = await User.findOne({ email: d.email }).select("+passwordHash");
  try {
    if (!existing) {
      const user = await User.create({ name: d.name, email: d.email, passwordHash: await hashPassword(d.password), role: "USER", locale: d.locale });
      await sendVerifyEmail(String(user._id), d.email, d.name, d.locale);
    } else if (!existing.emailVerified) {
      existing.name = existing.name || d.name;
      existing.passwordHash = await hashPassword(d.password);
      await existing.save();
      await sendVerifyEmail(String(existing._id), d.email, existing.name ?? d.name, d.locale);
    } else {
      await sendEmail({
        to: d.email,
        subject: d.locale === "ne" ? "तपाईंको खाता पहिले नै छ – मन्त्रास्फियर" : "You already have an account – MantraSphere Real Estate",
        text:
          d.locale === "ne"
            ? `कसैले यो इमेलबाट फेरि दर्ता गर्न खोज्यो। लग इन गर्नुहोस्: ${absoluteUrl(d.locale, "/login")}\nपासवर्ड बिर्सनुभयो? ${absoluteUrl(d.locale, "/forgot-password")}`
            : `Someone tried to sign up again with this email. Log in here: ${absoluteUrl(d.locale, "/login")}\nForgot your password? ${absoluteUrl(d.locale, "/forgot-password")}`,
      });
    }
  } catch (e) {
    console.error("[register]", (e as Error).message);
    return { ok: false, error: "server" };
  }
  return { ok: true };
}

/** Called by the verify-email page (server component). */
export async function confirmEmail(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  await connectDB();
  const t = await AuthToken.findOneAndDelete({ tokenHash: hashToken(token), kind: "EMAIL_VERIFY" });
  if (!t || t.expiresAt.getTime() < Date.now()) return false;
  await User.updateOne({ _id: t.user }, { $set: { emailVerified: new Date() } });
  return true;
}

export async function requestPasswordReset(input: { email: string; token?: string; locale: Locale }): Promise<ActionResult> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const loc = locale.parse(input.locale);
  if (!z.string().email().max(120).safeParse(email).success) return { ok: false, error: "invalid" };
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, 5, 60 * 60_000).ok || !rateLimit(`reset:${email}`, 3, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(input.token, ip))) return { ok: false, error: "captcha" };

  await connectDB();
  const user = await User.findOne({ email, disabled: trusted({ $ne: true }) });
  if (user) {
    await AuthToken.deleteMany({ user: user._id, kind: "PASSWORD_RESET" });
    const { token, hash } = newToken();
    await AuthToken.create({ kind: "PASSWORD_RESET", user: user._id, tokenHash: hash, expiresAt: new Date(Date.now() + 3600_000) });
    const link = `${absoluteUrl(loc, "/reset-password")}?token=${token}`;
    await sendEmail({
      to: email,
      subject: loc === "ne" ? "पासवर्ड रिसेट – मन्त्रास्फियर" : "Reset your password – MantraSphere Real Estate",
      text: `${loc === "ne" ? "नयाँ पासवर्ड राख्न यो लिंक खोल्नुहोस् (१ घण्टाभित्र):" : "Open this link within 1 hour to choose a new password:"}\n${link}\n\n${loc === "ne" ? "तपाईंले अनुरोध गर्नुभएको होइन भने यो इमेल बेवास्ता गर्नुहोस्।" : "If you didn't ask for this, ignore this email."}`,
      html: `<p><a href="${esc(link)}">${loc === "ne" ? "नयाँ पासवर्ड राख्नुहोस्" : "Choose a new password"}</a></p>`,
    });
  }
  return { ok: true };
}

export async function resetPassword(input: { token: string; password: string }): Promise<ActionResult> {
  const token = String(input.token ?? "");
  const password = String(input.password ?? "");
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, error: "invalid_token" };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: `password_${problem}` };
  await connectDB();
  const t = await AuthToken.findOneAndDelete({ tokenHash: hashToken(token), kind: "PASSWORD_RESET" });
  if (!t || t.expiresAt.getTime() < Date.now()) return { ok: false, error: "invalid_token" };
  await User.updateOne(
    { _id: t.user },
    // The reset link proves inbox ownership; existing sessions are invalidated.
    { $set: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), emailVerified: new Date() } },
  );
  await AuthToken.deleteMany({ user: t.user, kind: "PASSWORD_RESET" });
  return { ok: true };
}
