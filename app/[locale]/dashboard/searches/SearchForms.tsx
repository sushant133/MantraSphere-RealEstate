"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useHydrated } from "@/components/forms/useHydrated";
import { inputCls, labelCls, outlineBtn, primaryBtn } from "@/components/forms/styles";
import { createSavedSearch, deleteSavedSearch, setSavedSearchActive } from "./actions";

export function NewSearchForm({ query, defaultName, canEmail, canSms }: { query: string; defaultName: string; canEmail: boolean; canSms: boolean }) {
  const t = useTranslations("searches");
  const router = useRouter();
  const ready = useHydrated();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const r = await createSavedSearch({
        query,
        name: String(fd.get("name") ?? ""),
        frequency: String(fd.get("frequency")) as "DAILY",
        email: fd.get("email") === "on",
        sms: fd.get("sms") === "on",
      });
      if (r.ok) router.replace("/dashboard/searches?saved=1");
      else setError(t(`errors.${r.error}`));
    });

  return (
    <form action={submit} className="mt-4 space-y-4 rounded-2xl border bg-card p-5">
      <div className="space-y-1.5">
        <label htmlFor="ss-name" className={labelCls}>
          {t("name")}
        </label>
        <input id="ss-name" name="name" defaultValue={defaultName} maxLength={80} className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ss-freq" className={labelCls}>
          {t("frequency")}
        </label>
        <select id="ss-freq" name="frequency" defaultValue="DAILY" className={inputCls}>
          {(["INSTANT", "DAILY", "WEEKLY"] as const).map((f) => (
            <option key={f} value={f}>
              {t(`frequencies.${f}`)}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="min-w-0 space-y-2">
        <legend className={labelCls}>{t("channels")}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="email" defaultChecked={canEmail} disabled={!canEmail} className="size-5 accent-[var(--primary)]" />
          <span>
            {t("byEmail")}
            {!canEmail ? <span className="block text-xs text-muted-foreground">{t("emailNeeded")}</span> : null}
          </span>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="sms" defaultChecked={!canEmail && canSms} disabled={!canSms} className="size-5 accent-[var(--primary)]" />
          <span>
            {t("bySms")}
            {!canSms ? <span className="block text-xs text-muted-foreground">{t("phoneNeeded")}</span> : null}
          </span>
        </label>
      </fieldset>
      <button type="submit" disabled={!ready || pending} className={primaryBtn}>
        {t("save")}
      </button>
      <p aria-live="polite" className="text-sm text-destructive">
        {error}
      </p>
    </form>
  );
}

export function SearchRowActions({ id, active, name }: { id: string; active: boolean; name: string }) {
  const t = useTranslations("searches");
  const ready = useHydrated();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={!ready || pending}
        onClick={() => start(async () => void (await setSavedSearchActive(id, !active)))}
        className={`${outlineBtn} h-11 px-4 text-sm`}
        aria-label={`${active ? t("pause") : t("resume")}: ${name}`}
      >
        {active ? t("pause") : t("resume")}
      </button>
      <button
        type="button"
        disabled={!ready || pending}
        onClick={() => {
          if (confirm(t("confirmDelete"))) start(async () => void (await deleteSavedSearch(id)));
        }}
        className="tap inline-flex items-center rounded-xl px-4 text-sm font-semibold text-destructive hover:bg-destructive/10"
        aria-label={`${t("delete")}: ${name}`}
      >
        {t("delete")}
      </button>
    </div>
  );
}
