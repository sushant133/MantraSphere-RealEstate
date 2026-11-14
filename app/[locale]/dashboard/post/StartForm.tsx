"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { accentBtn } from "@/components/forms/styles";
import { PROPERTY_TYPES, PURPOSES, type PropertyType, type Purpose } from "@/lib/constants";
import { typeLabel } from "@/lib/titles";
import { cn } from "@/lib/utils";
import { createDraft } from "../actions";

/** Step 0: purpose + type, then a draft is created and the wizard opens. */
export function StartForm({ locale, planSlug }: { locale: "en" | "ne"; planSlug?: string }) {
  const t = useTranslations("wizard");
  const [purpose, setPurpose] = useState<Purpose>("SALE");
  const [type, setType] = useState<PropertyType>("HOUSE");
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const chip = (on: boolean) =>
    cn("tap flex cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createDraft({ purpose, type, locale, planSlug });
          if (r && !r.ok) setError(true);
        });
      }}
      className="space-y-6"
    >
      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold">{t("purpose")}</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PURPOSES.map((p) => (
            <label key={p} className={chip(purpose === p)}>
              <input type="radio" name="purpose" value={p} checked={purpose === p} onChange={() => setPurpose(p)} className="sr-only" />
              {t(`purposes.${p}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold">{t("type")}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROPERTY_TYPES.map((p) => (
            <label key={p} className={chip(type === p)}>
              <input type="radio" name="type" value={p} checked={type === p} onChange={() => setType(p)} className="sr-only" />
              {typeLabel(p, locale)}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-destructive">{t("saveFailed")}</p> : null}
      <button type="submit" disabled={pending} className={accentBtn}>
        {t("start")}
      </button>
    </form>
  );
}
