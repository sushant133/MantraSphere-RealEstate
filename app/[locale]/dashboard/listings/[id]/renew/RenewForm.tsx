"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { accentBtn } from "@/components/forms/styles";
import { formatPriceCompact } from "@/lib/price";
import { cn } from "@/lib/utils";
import { renewListing } from "../../../actions";

type P = { id: string; name: string; priceNpr: number; durationDays: number | null; features: string[] };

export function RenewForm({ listingId, plans, current, locale }: { listingId: string; plans: P[]; current: string | null; locale: "en" | "ne" }) {
  const t = useTranslations("dashboard");
  const tw = useTranslations("wizard");
  const [plan, setPlan] = useState(current ?? plans[0]?.id ?? "");
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await renewListing(listingId, plan, locale);
          if (r && !r.ok) setErr(true);
        });
      }}
      className="space-y-5"
    >
      <fieldset className="min-w-0">
        <legend className="sr-only">{t("renew")}</legend>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <label key={p.id} className={cn("flex cursor-pointer flex-col rounded-2xl border bg-card p-5", plan === p.id && "border-primary ring-2 ring-primary")}>
              <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
              <span className="flex items-center justify-between text-lg font-bold text-primary">
                {p.name}
                {plan === p.id ? <Check className="size-5" aria-hidden="true" /> : null}
              </span>
              <span className="text-2xl font-bold text-price">{formatPriceCompact(p.priceNpr, locale)}</span>
              <span className="text-sm text-muted-foreground">{p.durationDays ? tw("days", { count: p.durationDays }) : tw("untilSold")}</span>
              <ul className="mt-2 space-y-1 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </label>
          ))}
        </div>
      </fieldset>
      {err ? <p role="alert" className="text-sm text-destructive">{t("saveError")}</p> : null}
      <button type="submit" disabled={pending || !plan} className={accentBtn}>
        {t("continueToPay")}
      </button>
    </form>
  );
}
