"use client";

import { useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { submitReport } from "@/app/[locale]/property/[slug]/actions";
import { Turnstile } from "@/components/forms/Turnstile";
import { useTurnstileToken } from "@/components/forms/useTurnstileToken";

const REASONS = ["SOLD", "WRONG_INFO", "DUPLICATE", "FRAUD", "OTHER"] as const;

/** "Report this listing" in a native <dialog>. */
export function ReportListing({ code, locale, siteKey }: { code: string; locale: "en" | "ne"; siteKey: string }) {
  const t = useTranslations("detail");
  const ref = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error" | "rate">("idle");
  const { onToken, waitForToken } = useTurnstileToken(siteKey);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus("sending");
    const token = await waitForToken();
    const r = await submitReport({
      code,
      reason: String(fd.get("reason")) as (typeof REASONS)[number],
      details: String(fd.get("details") ?? ""),
      website: String(fd.get("website") ?? ""),
      token,
    });
    setStatus(r.ok ? "done" : r.error === "rate_limited" ? "rate" : "error");
  };

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="tap inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <Flag className="size-4" aria-hidden="true" />
        {t("report")}
      </button>
      <dialog ref={ref} aria-labelledby="report-title" className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-black/50">
        <div className="p-5">
          <h2 id="report-title" className="text-lg font-semibold">
            {t("report")}
          </h2>
          {status === "done" ? (
            <>
              <p role="status" className="mt-3 text-sm text-success">
                {t("reportThanks")}
              </p>
              <button type="button" onClick={() => ref.current?.close()} className="tap mt-4 rounded-xl border px-4 text-sm font-semibold">
                {t("close")}
              </button>
            </>
          ) : (
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <fieldset className="min-w-0">
                <legend className="text-sm font-semibold">{t("reportReason")}</legend>
                <div className="mt-2 space-y-1">
                  {REASONS.map((r, i) => (
                    <label key={r} className="tap flex cursor-pointer items-center gap-3 text-sm">
                      <input type="radio" name="reason" value={r} defaultChecked={i === 0} className="size-4 accent-[var(--primary)]" />
                      {t(`reportReasons.${r}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="report-details" className="text-sm font-semibold">
                  {t("reportDetails")}
                </label>
                <textarea id="report-details" name="details" rows={3} maxLength={1000} className="mt-1 w-full rounded-xl border px-3 py-2 text-base" />
              </div>
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <input name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <Turnstile siteKey={siteKey} onToken={onToken} locale={locale} />
              <div aria-live="polite">
                {status === "error" ? <p className="text-sm text-destructive">{t("sendError")}</p> : null}
                {status === "rate" ? <p className="text-sm text-destructive">{t("tooMany")}</p> : null}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => ref.current?.close()} className="tap rounded-xl px-4 text-sm font-semibold hover:bg-muted">
                  {t("cancel")}
                </button>
                <button type="submit" disabled={status === "sending"} className="tap rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {t("reportSubmit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
