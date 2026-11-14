"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { inputCls, labelCls, outlineBtn } from "@/components/forms/styles";
import { loanSummary } from "@/lib/emi";
import { formatPriceFull, formatPriceWords, parsePrice, toDevanagariDigits } from "@/lib/price";

type Rate = { bank: string; ratePct: number; updated: string };

export function EmiCalculator({ locale, rates, defaultRate }: { locale: "en" | "ne"; rates: Rate[]; defaultRate: number }) {
  const t = useTranslations("tools.emi");
  const id = useId();
  const [amountText, setAmountText] = useState("50 lakh");
  const [rate, setRate] = useState(String(defaultRate));
  const [years, setYears] = useState("20");

  // ?amount=12500000 from a listing's "Calculate EMI" link.
  useEffect(() => {
    const a = Number(new URLSearchParams(window.location.search).get("amount"));
    if (Number.isSafeInteger(a) && a > 0) setAmountText(String(a));
  }, []);

  const principal = parsePrice(amountText) ?? 0;
  const r = Number(rate);
  const y = Number(years);
  const valid = principal >= 10_000 && principal <= 1e11 && r > 0 && r <= 30 && y >= 1 && y <= 30;
  const s = useMemo(() => (valid ? loanSummary(principal, r, y) : null), [valid, principal, r, y]);
  const npr = (v: number) => formatPriceFull(Math.round(v), locale);
  const n = (v: string) => (locale === "ne" ? toDevanagariDigits(v) : v);
  const interestShare = s ? Math.round((s.totalInterest / s.totalPaid) * 100) : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <form className="space-y-5 rounded-3xl border bg-card p-6 lg:col-span-5" onSubmit={(e) => e.preventDefault()} aria-label={t("formLabel")}>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-amt`} className={labelCls}>
            {t("amount")}
          </label>
          <input id={`${id}-amt`} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} className={inputCls} aria-describedby={`${id}-amt-hint`} />
          <p id={`${id}-amt-hint`} className="text-sm text-muted-foreground" aria-live="polite">
            {principal > 0 ? t("inWords", { words: formatPriceWords(principal, locale) }) : t("amountHint")}
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-rate`} className={labelCls}>
            {t("rate")}
          </label>
          <input id={`${id}-rate`} type="number" inputMode="decimal" min={1} max={30} step={0.01} value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-yrs`} className={labelCls}>
            {t("years")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={30}
              value={Number.isFinite(y) ? Math.min(30, Math.max(1, y)) : 20}
              onChange={(e) => setYears(e.target.value)}
              aria-label={t("years")}
              className="h-11 flex-1 accent-[var(--primary)]"
            />
            <input id={`${id}-yrs`} type="number" inputMode="numeric" min={1} max={30} value={years} onChange={(e) => setYears(e.target.value)} className={`${inputCls} w-24`} />
          </div>
        </div>
        {!valid ? (
          <p role="alert" className="text-sm text-destructive">
            {t("invalid")}
          </p>
        ) : null}
      </form>

      <section aria-labelledby={`${id}-res`} className="lg:col-span-7">
        <h2 id={`${id}-res`} className="sr-only">
          {t("result")}
        </h2>
        <div className="rounded-3xl bg-primary p-6 text-primary-foreground" aria-live="polite">
          <p className="text-sm font-medium opacity-85">{t("monthly")}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">{s ? npr(s.emi) : "—"}</p>
          {s ? <p className="mt-1 text-sm opacity-85">{t("forMonths", { months: n(String(s.months)) })}</p> : null}
        </div>
        {s ? (
          <>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{t("principal")}</dt>
                <dd className="mt-1 text-lg font-semibold">{npr(principal)}</dd>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{t("totalInterest")}</dt>
                <dd className="mt-1 text-lg font-semibold">{npr(s.totalInterest)}</dd>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{t("totalPaid")}</dt>
                <dd className="mt-1 text-lg font-semibold">{npr(s.totalPaid)}</dd>
              </div>
            </dl>
            <figure className="mt-4">
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                <div className="rounded-l-full bg-primary" style={{ width: `${100 - interestShare}%` }} />
                <div className="rounded-r-full bg-saffron" style={{ width: `${interestShare}%` }} />
              </div>
              <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="size-3 rounded-sm bg-primary" aria-hidden="true" />
                  {t("principalShare", { pct: n(String(100 - interestShare)) })}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-3 rounded-sm bg-saffron" aria-hidden="true" />
                  {t("interestShare", { pct: n(String(interestShare)) })}
                </span>
              </figcaption>
            </figure>
            <details className="mt-6 rounded-2xl border bg-card">
              <summary className="tap flex cursor-pointer items-center px-5 font-semibold">{t("schedule")}</summary>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full min-w-[480px] text-sm">
                  <caption className="sr-only">{t("schedule")}</caption>
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        {t("year")}
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        {t("principalPaid")}
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        {t("interestPaid")}
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {t("balance")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {s.schedule.map((row) => (
                      <tr key={row.year} className="border-b last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-medium">
                          {n(String(row.year))}
                        </th>
                        <td className="py-2 pr-3 text-right">{npr(row.principalPaid)}</td>
                        <td className="py-2 pr-3 text-right">{npr(row.interestPaid)}</td>
                        <td className="py-2 text-right">{npr(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : null}

        {rates.length ? (
          <div className="mt-8">
            <h2 className="text-lg font-semibold">{t("bankRates")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("bankRatesNote")}</p>
            <ul className="mt-3 divide-y rounded-2xl border bg-card">
              {rates.map((b) => (
                <li key={b.bank} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="font-medium">{b.bank}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{t("updated", { date: b.updated })}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{n(b.ratePct.toFixed(2))}%</span>
                    <button type="button" onClick={() => setRate(String(b.ratePct))} className={`${outlineBtn} h-11 px-3 text-sm`} aria-label={t("useRateFor", { bank: b.bank })}>
                      {t("useRate")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-6 text-xs text-muted-foreground">{t("disclaimer")}</p>
      </section>
    </div>
  );
}
