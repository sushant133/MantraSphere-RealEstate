"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Turnstile } from "@/components/forms/Turnstile";
import { useTurnstileToken } from "@/components/forms/useTurnstileToken";
import { inputCls, labelCls, linkCls, outlineBtn, primaryBtn } from "@/components/forms/styles";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { googleLogin, passwordLogin, sendLoginCode, verifyLoginCode } from "../actions";

type Method = "phone" | "email";

export function LoginForm({
  locale,
  next,
  siteKey,
  google,
  initialMethod,
}: {
  locale: "en" | "ne";
  next: string;
  siteKey: string;
  google: boolean;
  initialMethod: Method;
}) {
  const t = useTranslations("auth");
  const [method, setMethod] = useState<Method>(initialMethod);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { onToken, waitForToken } = useTurnstileToken(siteKey);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const err = (code: string) => t(`errors.${code}` as "errors.server");

  const send = () =>
    start(async () => {
      setError(null);
      const token = await waitForToken();
      const r = await sendLoginCode({ phone, token, locale });
      if (!r.ok) return setError(err(r.error));
      setSentTo(r.phone ?? phone);
      setCode("");
      setCooldown(60);
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const r = await verifyLoginCode({ phone: sentTo!, code, next, locale });
      if (r && !r.ok) setError(err(r.error));
    });

  const emailLogin = (fd: FormData) =>
    start(async () => {
      setError(null);
      const r = await passwordLogin({ email: String(fd.get("email")), password: String(fd.get("password")), next, locale });
      if (r && !r.ok) setError(err(r.error));
    });

  const tab = (m: Method, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${m}`}
      aria-selected={method === m}
      aria-controls={`panel-${m}`}
      onClick={() => {
        setMethod(m);
        setError(null);
      }}
      className={cn("tap flex-1 rounded-lg px-3 text-sm font-semibold", method === m ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div role="tablist" aria-label={t("methods")} className="flex gap-1 rounded-xl bg-muted p-1">
        {tab("phone", t("tabPhone"))}
        {tab("email", t("tabEmail"))}
      </div>

      <div className="mt-6" aria-live="polite">
        {error ? (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {method === "phone" ? (
        <div id="panel-phone" role="tabpanel" aria-labelledby="tab-phone">
          {!sentTo ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label htmlFor="login-phone" className={labelCls}>
                  {t("phone")}
                </label>
                <div className="flex">
                  <span className="inline-flex h-11 items-center rounded-l-xl border border-r-0 bg-muted px-3 text-sm text-muted-foreground" aria-hidden="true">
                    +977
                  </span>
                  <input
                    id="login-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    aria-describedby="login-phone-hint"
                    className={cn(inputCls, "rounded-l-none")}
                  />
                </div>
                <p id="login-phone-hint" className="text-xs text-muted-foreground">
                  {t("phoneHint")}
                </p>
              </div>
              <Turnstile siteKey={siteKey} onToken={onToken} locale={locale} />
              <button type="submit" disabled={pending} className={cn(primaryBtn, "w-full")}>
                {pending ? t("sending") : t("sendCode")}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">{t("codeSentTo", { phone: formatPhoneDisplay(sentTo) })}</p>
              <div className="space-y-1.5">
                <label htmlFor="login-code" className={labelCls}>
                  {t("code")}
                </label>
                <input
                  id="login-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className={cn(inputCls, "text-center font-mono text-2xl tracking-[0.5em]")}
                />
              </div>
              <button type="submit" disabled={pending || code.length !== 6} className={cn(primaryBtn, "w-full")}>
                {pending ? t("verifying") : t("verify")}
              </button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button type="button" onClick={() => setSentTo(null)} className={cn("tap", linkCls)}>
                  {t("changeNumber")}
                </button>
                {cooldown > 0 ? (
                  <span className="text-muted-foreground">{t("resendIn", { seconds: cooldown })}</span>
                ) : (
                  <button type="button" onClick={send} disabled={pending} className={cn("tap", linkCls)}>
                    {t("resend")}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      ) : (
        <div id="panel-email" role="tabpanel" aria-labelledby="tab-email">
          <form action={emailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className={labelCls}>
                {t("email")}
              </label>
              <input id="login-email" name="email" type="email" autoComplete="email" required className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="login-password" className={labelCls}>
                  {t("password")}
                </label>
                <Link href="/forgot-password" className={cn("text-sm", linkCls)}>
                  {t("forgot")}
                </Link>
              </div>
              <input id="login-password" name="password" type="password" autoComplete="current-password" required className={inputCls} />
            </div>
            <button type="submit" disabled={pending} className={cn(primaryBtn, "w-full")}>
              {t("logIn")}
            </button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className={linkCls}>
              {t("createAccount")}
            </Link>
          </p>
        </div>
      )}

      {google ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("orContinueWith")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={() => googleLogin(next, locale)}>
            <button type="submit" className={cn(outlineBtn, "w-full")}>
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-2 3.2-4.9 3.2-8.2z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
              </svg>
              {t("google")}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
