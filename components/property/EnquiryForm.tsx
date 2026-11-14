"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "@/lib/zod-client";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { submitEnquiry } from "@/app/[locale]/property/[slug]/actions";
import { Turnstile } from "@/components/forms/Turnstile";
import { useTurnstileToken } from "@/components/forms/useTurnstileToken";
import { NP_MOBILE_RE, cleanPhoneInput } from "@/lib/phone";

/** Enquiry → Lead. Zod on the client for instant feedback, re-validated on the server. */
export function EnquiryForm({ code, locale, siteKey }: { code: string; locale: "en" | "ne"; siteKey: string }) {
  const t = useTranslations("detail");
  const schema = z.object({
    name: z.string().trim().min(2, t("errors.name")).max(80),
    phone: z.string().refine((v) => NP_MOBILE_RE.test(cleanPhoneInput(v).replace(/-/g, "")), t("errors.phone")),
    email: z.union([z.literal(""), z.string().trim().email(t("errors.email"))]),
    message: z.string().trim().min(10, t("errors.message")).max(2000),
    website: z.string().max(0),
  });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, formState, setError, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", message: t("messageDefault", { code }), website: "" },
  });
  const { onToken, waitForToken } = useTurnstileToken(siteKey);
  const [status, setStatus] = useState<"idle" | "sent" | "error" | "rate" | "captcha">("idle");

  const onSubmit = async (v: Values) => {
    const token = await waitForToken();
    if (siteKey && !token) return setStatus("captcha");
    const r = await submitEnquiry({ ...v, code, token });
    if (r.ok) {
      setStatus("sent");
      reset();
      return;
    }
    if (r.error === "invalid" && r.fields?.includes("phone")) setError("phone", { message: t("errors.phone") });
    setStatus(r.error === "rate_limited" ? "rate" : r.error === "captcha" ? "captcha" : "error");
  };

  if (status === "sent") {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-success/10 p-4 text-sm font-medium text-success" role="status">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t("sent")}
      </p>
    );
  }

  const input = "h-11 w-full rounded-xl border border-input bg-background px-3 text-base aria-invalid:border-destructive";
  const err = (k: keyof Values) =>
    formState.errors[k] ? (
      <p id={`enq-${k}-err`} className="mt-1 text-sm text-destructive">
        {formState.errors[k]?.message}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3" aria-labelledby="enquiry-title">
      <div>
        <label htmlFor="enq-name" className="text-sm font-medium">
          {t("name")}
        </label>
        <input id="enq-name" autoComplete="name" className={input} aria-invalid={!!formState.errors.name} aria-describedby="enq-name-err" {...register("name")} />
        {err("name")}
      </div>
      <div>
        <label htmlFor="enq-phone" className="text-sm font-medium">
          {t("phone")}
        </label>
        <input
          id="enq-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98XXXXXXXX"
          className={input}
          aria-invalid={!!formState.errors.phone}
          aria-describedby="enq-phone-err"
          {...register("phone")}
        />
        {err("phone")}
      </div>
      <div>
        <label htmlFor="enq-email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input id="enq-email" type="email" autoComplete="email" className={input} aria-invalid={!!formState.errors.email} aria-describedby="enq-email-err" {...register("email")} />
        {err("email")}
      </div>
      <div>
        <label htmlFor="enq-message" className="text-sm font-medium">
          {t("message")}
        </label>
        <textarea
          id="enq-message"
          rows={4}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-base aria-invalid:border-destructive"
          aria-invalid={!!formState.errors.message}
          aria-describedby="enq-message-err"
          {...register("message")}
        />
        {err("message")}
      </div>
      {/* Honeypot: hidden from people and assistive tech, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="enq-website">Website</label>
        <input id="enq-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>
      <Turnstile siteKey={siteKey} onToken={onToken} locale={locale} />
      <button
        type="submit"
        disabled={formState.isSubmitting}
        className="tap w-full rounded-xl bg-saffron px-4 text-base font-semibold text-saffron-foreground hover:bg-saffron/90 disabled:opacity-60"
      >
        {formState.isSubmitting ? t("sending") : t("send")}
      </button>
      <p className="text-xs text-muted-foreground">{t("privacyNote")}</p>
      <div aria-live="polite">
        {status === "error" ? <p className="text-sm text-destructive">{t("sendError")}</p> : null}
        {status === "rate" ? <p className="text-sm text-destructive">{t("tooMany")}</p> : null}
        {status === "captcha" ? <p className="text-sm text-destructive">{t("errors.captcha")}</p> : null}
      </div>
    </form>
  );
}
