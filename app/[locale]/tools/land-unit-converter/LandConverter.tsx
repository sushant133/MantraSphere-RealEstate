"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { inputCls, labelCls } from "@/components/forms/styles";
import { formatNumber, toAsciiDigits } from "@/lib/price";
import { SQFT, formatAreaInput, sqFtToBkd, sqFtToRapd } from "@/lib/units";

const UNITS = ["ROPANI", "AANA", "PAISA", "DAAM", "BIGHA", "KATTHA", "DHUR", "SQFT", "SQM"] as const;
type Unit = (typeof UNITS)[number];

export function LandConverter({ locale }: { locale: "en" | "ne" }) {
  const t = useTranslations("tools.land");
  const id = useId();
  const [value, setValue] = useState("1");
  const [unit, setUnit] = useState<Unit>("ROPANI");
  const v = Number(toAsciiDigits(value).replace(/,/g, ""));
  const valid = Number.isFinite(v) && v > 0 && v < 1e9;
  const sqft = valid ? v * SQFT[unit] : 0;
  const fmt = (n: number) => formatNumber(n, locale, n < 10 ? 4 : 2);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <form className="space-y-5 rounded-3xl border bg-card p-6 lg:col-span-5" onSubmit={(e) => e.preventDefault()} aria-label={t("formLabel")}>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-v`} className={labelCls}>
            {t("value")}
          </label>
          <input id={`${id}-v`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-u`} className={labelCls}>
            {t("from")}
          </label>
          <select id={`${id}-u`} value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className={inputCls}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`units.${u}`)}
              </option>
            ))}
          </select>
        </div>
        {!valid ? (
          <p role="alert" className="text-sm text-destructive">
            {t("invalid")}
          </p>
        ) : null}
      </form>

      <section aria-labelledby={`${id}-res`} className="lg:col-span-7" aria-live="polite">
        <h2 id={`${id}-res`} className="text-lg font-semibold">
          {t("result")}
        </h2>
        {valid ? (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <p className="text-sm opacity-85">{t("hillSystem")}</p>
                <p className="mt-1 text-xl font-bold">{formatAreaInput({ system: "RAPD", values: sqFtToRapd(sqft) }, locale)}</p>
              </div>
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <p className="text-sm opacity-85">{t("teraiSystem")}</p>
                <p className="mt-1 text-xl font-bold">{formatAreaInput({ system: "BKD", values: sqFtToBkd(sqft) }, locale)}</p>
              </div>
            </div>
            <table className="mt-4 w-full overflow-hidden rounded-2xl border bg-card text-sm">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <tbody className="tabular-nums">
                {UNITS.filter((u) => u !== unit).map((u) => (
                  <tr key={u} className="border-b last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      {t(`units.${u}`)}
                    </th>
                    <td className="px-5 py-3 text-right font-semibold">{fmt(sqft / SQFT[u])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </section>
    </div>
  );
}
