import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { User } from "@/models";
import type { Role } from "@/lib/constants";
import { verifyOtp } from "./otp";
import { verifyPassword } from "./secrets";

/**
 * Auth.js v5: phone OTP, email + password, and Google (when configured).
 * Sessions are JWTs (required for credentials sign-in); the token is
 * re-checked against the database every few minutes so disabling a user,
 * changing their role or resetting their password takes effect quickly.
 */

class InvalidCode extends CredentialsSignin {
  code = "invalid_code";
}
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class EmailUnverified extends CredentialsSignin {
  code = "email_unverified";
}
class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

const REFRESH_MS = 5 * 60_000;

const ipOf = (req: Request | undefined) =>
  req?.headers.get("cf-connecting-ip") ?? req?.headers.get("x-real-ip") ?? req?.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "0.0.0.0";

const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(async () => (await connectDB()).connection.getClient(), {
    collections: { Users: "users", Accounts: "accounts", Sessions: "sessions", VerificationTokens: "verification_tokens" },
  }),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/en/login", error: "/en/login" },
  providers: [
    Credentials({
      id: "phone-otp",
      name: "Mobile number",
      credentials: { phone: {}, code: {}, locale: {} },
      async authorize(c, req) {
        const phone = normalizePhone(String(c?.phone ?? ""));
        if (!phone || phone.kind !== "MOBILE") throw new InvalidCode();
        if (!rateLimit(`otp-verify:${ipOf(req)}`, 20, 15 * 60_000).ok) throw new RateLimited();
        if (!(await verifyOtp(phone.e164, String(c?.code ?? "")))) throw new InvalidCode();
        await connectDB();
        let user = await User.findOne({ phone: phone.e164 });
        if (!user) {
          user = await User.create({ phone: phone.e164, phoneVerified: new Date(), role: "USER", locale: c?.locale === "ne" ? "ne" : "en" });
        } else if (!user.phoneVerified) {
          user.phoneVerified = new Date();
          await user.save();
        }
        if (user.disabled) throw new InvalidCredentials();
        return { id: String(user._id), name: user.name ?? null, email: user.email ?? null, role: user.role as Role };
      },
    }),
    Credentials({
      id: "password",
      name: "Email",
      credentials: { email: {}, password: {} },
      async authorize(c, req) {
        const email = String(c?.email ?? "").trim().toLowerCase();
        const password = String(c?.password ?? "");
        if (!email || !password || email.length > 120 || password.length > 200) throw new InvalidCredentials();
        if (!rateLimit(`pw:email:${email}`, 10, 15 * 60_000).ok || !rateLimit(`pw:ip:${ipOf(req)}`, 30, 15 * 60_000).ok) {
          throw new RateLimited();
        }
        await connectDB();
        const user = await User.findOne({ email }).select("+passwordHash");
        // Same error for unknown email and wrong password (no account enumeration).
        if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw new InvalidCredentials();
        if (!user.emailVerified) throw new EmailUnverified();
        if (user.disabled) throw new InvalidCredentials();
        return { id: String(user._id), name: user.name ?? null, email: user.email ?? null, role: user.role as Role };
      },
    }),
    ...(googleEnabled ? [Google({ allowDangerousEmailAccountLinking: true })] : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id as string;
        token.role = ((user as { role?: Role }).role ?? "USER") as Role;
        token.checkedAt = Date.now();
        return token;
      }
      if (!token.uid) return null;
      if (trigger === "update" || !token.checkedAt || Date.now() - (token.checkedAt as number) > REFRESH_MS) {
        await connectDB();
        const u = await User.findById(token.uid).select("role disabled passwordChangedAt").lean();
        if (!u || u.disabled) return null;
        // iat has 1-second resolution: allow a 1 s margin for a login right after a reset.
        if (u.passwordChangedAt && token.iat && u.passwordChangedAt.getTime() - 1000 > (token.iat as number) * 1000) return null;
        token.role = (u.role ?? "USER") as Role;
        token.checkedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid as string;
        session.user.role = (token.role ?? "USER") as Role;
      }
      return session;
    },
  },
  events: {
    // Users created by the adapter (Google) need our defaults.
    async createUser({ user }) {
      await connectDB();
      await User.updateOne({ _id: user.id }, { $set: { role: "USER", disabled: false, verified: false, createdAt: new Date(), updatedAt: new Date() } });
    },
    async signIn({ user }) {
      if (!user.id) return;
      await connectDB();
      await User.updateOne({ _id: user.id }, { $set: { lastLoginAt: new Date() } });
    },
  },
});

export const isGoogleEnabled = () => googleEnabled;
