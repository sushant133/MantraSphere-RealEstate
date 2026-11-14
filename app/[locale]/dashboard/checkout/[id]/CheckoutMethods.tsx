"use client";

import { useRef, useState, useTransition } from "react";
import { Building2, CreditCard, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { accentBtn, inputCls, labelCls, outlineBtn, primaryBtn } from "@/components/forms/styles";
import type { PaymentProvider } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { payWith } from "../../actions";
import { useHydrated } from "@/components/forms/useHydrated";

type Bank = { bank: string; accountName: string; accountNumber: string; branch: string };

export function CheckoutMethods({ paymentId, providers, banks, locale }: { paymentId: string; providers: PaymentProvider[]; banks: Bank[]; locale: "en" | "ne" }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [bankMsg, setBankMsg] = useState<string | null>(null);
  const ready = useHydrated();

  const pay = (p: PaymentProvider) =>
    start(async () => {
      setError(null);
      const r = await payWith(paymentId, p, locale);
      if (r.kind === "form") {
        setForm(r);
        // eSewa needs a POST from the browser.
        requestAnimationFrame(() => formRef.current?.submit());
      } else if (r.kind === "redirect") window.location.assign(r.url);
      else setError(t("error"));
    });

  const sendSlip = (fd: FormData) =>
    start(async () => {
      setBankMsg(null);
      fd.set("paymentId", paymentId);
      const res = await fetch("/api/payments/bank", { method: "POST", body: fd }).catch(() => null);
      if (res?.ok) router.push(`/dashboard/checkout/${paymentId}/result`);
      else setBankMsg(t("error"));
    });

  const gateway = (p: PaymentProvider, label: string, Icon: typeof Wallet, cls: string) => (
    <button key={p} type="button" disabled={!ready || pending} onClick={() => pay(p)} className={cn("tap h-14 w-full justify-start text-base", cls)}>
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("chooseMethod")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.includes("ESEWA") ? gateway("ESEWA", t("esewa"), Wallet, cn(primaryBtn, "bg-[#2f7d32] hover:bg-[#276a2a]")) : null}
        {providers.includes("KHALTI") ? gateway("KHALTI", t("khalti"), Wallet, cn(primaryBtn, "bg-[#5c2d91] hover:bg-[#4d2579]")) : null}
        {providers.includes("MOCK") ? (
          <div>
            {gateway("MOCK", t("mock"), CreditCard, accentBtn)}
            <p className="mt-1 text-xs text-muted-foreground">{t("mockNote")}</p>
          </div>
        ) : null}
      </div>
      <div aria-live="polite">
        {pending ? <p className="text-sm">{t("redirecting")}</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      {form ? (
        <form ref={formRef} method="POST" action={form.action} className="hidden">
          {Object.entries(form.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      ) : null}

      <details className="rounded-2xl border bg-card p-5">
        <summary className="tap flex cursor-pointer items-center gap-2 font-semibold">
          <Building2 className="size-5" aria-hidden="true" />
          {t("bank")}
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">{t("bankIntro")}</p>
        {banks.length ? (
          <ul className="mt-3 space-y-2">
            {banks.map((b) => (
              <li key={b.accountNumber} className="rounded-xl bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{b.bank}</p>
                <p>
                  {t("accountName")}: {b.accountName}
                </p>
                <p>
                  {t("accountNumber")}: <span className="font-mono">{b.accountNumber}</span>
                </p>
                {b.branch ? (
                  <p>
                    {t("branch")}: {b.branch}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm">{t("noBankAccounts")}</p>
        )}
        <form action={sendSlip} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="bank-ref" className={labelCls}>
              {t("reference")}
            </label>
            <input id="bank-ref" name="reference" required minLength={3} maxLength={80} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bank-slip" className={labelCls}>
              {t("slip")}
            </label>
            <input id="bank-slip" name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="block text-sm" />
          </div>
          <button type="submit" disabled={!ready || pending} className={outlineBtn}>
            {t("submitSlip")}
          </button>
          <p aria-live="polite" className="text-sm text-destructive">
            {bankMsg}
          </p>
        </form>
      </details>
    </div>
  );
}
