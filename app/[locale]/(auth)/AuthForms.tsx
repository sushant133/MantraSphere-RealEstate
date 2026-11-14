"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Turnstile } from "@/components/forms/Turnstile";
import { useTurnstileToken } from "@/components/forms/useTurnstileToken";
import { inputCls, labelCls, linkCls, primaryBtn } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { confirmEmail, register, requestPasswordReset, resetPassword } from "./actions";

type Loc = "en" | "ne";

function Done({ text, login = true }: { text: string; login?: boolean }) {
  const t = useTranslations("auth");
  return (
    <div role="status" className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl bg-success/10 p-4 text-sm font-medium text-success">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {text}
      </p>
      {login ? (
        <Link href="/login?method=email" className={cn(primaryBtn, "w-full")}>
          {t("backToLogin")}
        </Link>
      ) : null}
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  return (
    <div aria-live="polite">
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RegisterForm({ locale, siteKey }: { locale: Loc; siteKey: string }) {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { onToken, waitForToken } = useTurnstileToken(siteKey);

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const password = String(fd.get("password"));
      if (password !== String(fd.get("confirm"))) return setError(t("errors.password_mismatch"));
      const email = String(fd.get("email"));
      const r = await register({
        name: String(fd.get("name")),
        email,
        password,
        accept: fd.get("accept") === "on",
        website: String(fd.get("website") ?? ""),
        token: await waitForToken(),
        locale,
      });
      if (!r.ok) return setError(t(`errors.${r.error}` as "errors.server"));
      setSent(email);
    });

  if (sent) return <Done text={t("checkEmailBody", { email: sent })} login={false} />;
  return (
    <form action={submit} className="space-y-4">
      <ErrorBox error={error} />
      <div className="space-y-1.5">
        <label htmlFor="reg-name" className={labelCls}>
          {t("name")}
        </label>
        <input id="reg-name" name="name" autoComplete="name" required minLength={2} maxLength={80} className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reg-email" className={labelCls}>
          {t("email")}
        </label>
        <input id="reg-email" name="email" type="email" autoComplete="email" required className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reg-password" className={labelCls}>
          {t("password")}
        </label>
        <input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="reg-pw-hint" className={inputCls} />
        <p id="reg-pw-hint" className="text-xs text-muted-foreground">
          {t("passwordHint")}
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reg-confirm" className={labelCls}>
          {t("confirmPassword")}
        </label>
        <input id="reg-confirm" name="confirm" type="password" autoComplete="new-password" required className={inputCls} />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="accept" required className="mt-0.5 size-5 accent-[var(--primary)]" />
        {t("accept")}
      </label>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Turnstile siteKey={siteKey} onToken={onToken} locale={locale} />
      <button type="submit" disabled={pending} className={cn(primaryBtn, "w-full")}>
        {t("createButton")}
      </button>
      <p className="text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className={linkCls}>
          {t("logIn")}
        </Link>
      </p>
    </form>
  );
}

export function ConfirmEmail({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");
  const [pending, start] = useTransition();
  if (state === "ok") return <Done text={t("verifiedOk")} />;
  if (state === "bad")
    return (
      <div className="space-y-4">
        <ErrorBox error={t("verifiedBad")} />
        <Link href="/register" className={linkCls}>
          {t("createAccount")}
        </Link>
      </div>
    );
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => setState((await confirmEmail(token)) ? "ok" : "bad"))} className={cn(primaryBtn, "w-full")}>
      {t("verifyTitle")}
    </button>
  );
}

export function ForgotForm({ locale, siteKey }: { locale: Loc; siteKey: string }) {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const { onToken, waitForToken } = useTurnstileToken(siteKey);
  if (done) return <Done text={t("forgotSent")} />;
  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await requestPasswordReset({ email: String(fd.get("email")), token: await waitForToken(), locale });
          if (!r.ok) return setError(t(`errors.${r.error}` as "errors.server"));
          setDone(true);
        })
      }
      className="space-y-4"
    >
      <ErrorBox error={error} />
      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className={labelCls}>
          {t("email")}
        </label>
        <input id="forgot-email" name="email" type="email" autoComplete="email" required className={inputCls} />
      </div>
      <Turnstile siteKey={siteKey} onToken={onToken} locale={locale} />
      <button type="submit" disabled={pending} className={cn(primaryBtn, "w-full")}>
        {t("sendLink")}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <Done text={t("resetDone")} />;
  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const password = String(fd.get("password"));
          if (password !== String(fd.get("confirm"))) return setError(t("errors.password_mismatch"));
          const r = await resetPassword({ token, password });
          if (!r.ok) return setError(t(`errors.${r.error}` as "errors.server"));
          setDone(true);
        })
      }
      className="space-y-4"
    >
      <ErrorBox error={error} />
      <div className="space-y-1.5">
        <label htmlFor="reset-password" className={labelCls}>
          {t("newPassword")}
        </label>
        <input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="reset-hint" className={inputCls} />
        <p id="reset-hint" className="text-xs text-muted-foreground">
          {t("passwordHint")}
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reset-confirm" className={labelCls}>
          {t("confirmPassword")}
        </label>
        <input id="reset-confirm" name="confirm" type="password" autoComplete="new-password" required className={inputCls} />
      </div>
      <button type="submit" disabled={pending} className={cn(primaryBtn, "w-full")}>
        {t("savePassword")}
      </button>
    </form>
  );
}
