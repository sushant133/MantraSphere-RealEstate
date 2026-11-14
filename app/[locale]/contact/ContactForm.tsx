"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "@/lib/zod-client";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Turnstile } from "@/components/forms/Turnstile";
import { useTurnstileToken } from "@/components/forms/useTurnstileToken";
import { useHydrated } from "@/components/forms/useHydrated";
import { accentBtn, inputCls, labelCls, textareaCls } from "@/components/forms/styles";
import { submitContact } from "./actions";

const TOPICS = ["BUY", "SELL", "PAYMENT", "OTHER"] as const;

export function ContactForm({ locale, siteKey }: { locale: "en" | "ne"; siteKey: string }) {
  const t = useTranslations("pages.contact");
  const ready = useHydrated();
  const schema = z.object({
    name: z.string().trim().min(2, t("errors.name")).max(80),
    // Mobile or landline; the server normalises and checks it properly.
    phone: z.string().refine((v) => /^\+?[\d\s-]{7,16}$/.test(v.trim()), t("errors.phone")),
    email: z.union([z.literal(""), z.string().trim().email(t("errors.email"))]),
    topic: z.enum(TOPICS),
    message: z.string().trim().min(10, t("errors.message")).max(2000),
    website: z.string().max(0),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState, setError, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", topic: "BUY", message: "", website: "" },
  });
  const { onToken, waitForToken } = useTurnstileToken(siteKey);
  const [status, setStatus] = useState<"idle" | "sent" | "error" | "rate" | "captcha">("idle");

  const onSubmit = async (v: Values) => {
    const token = await waitForToken();
    if (siteKey && !token) return setStatus("captcha");
    const r = await submitContact({ ...v, token });
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
      <p role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-4 font-medium text-success">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t("sent")}
      </p>
    );
  }

  const err = (k: keyof Values) =>
    formState.errors[k] ? (
      <p id={`ct-${k}-err`} className="text-sm text-destructive">
        {formState.errors[k]?.message}
      </p>
    ) : null;
  const aria = (k: keyof Values) => ({ "aria-invalid": !!formState.errors[k], "aria-describedby": `ct-${k}-err` });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="ct-name" className={labelCls}>
            {t("name")}
          </label>
          <input id="ct-name" autoComplete="name" className={inputCls} {...aria("name")} {...register("name")} />
          {err("name")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ct-phone" className={labelCls}>
            {t("phone")}
          </label>
          <input id="ct-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" className={inputCls} {...aria("phone")} {...register("phone")} />
          {err("phone")}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="ct-email" className={labelCls}>
            {t("email")}
          </label>
          <input id="ct-email" type="email" autoComplete="email" className={inputCls} {...aria("email")} {...register("email")} />
          {err("email")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ct-topic" className={labelCls}>
            {t("topic")}
          </label>
          <select id="ct-topic" className={inputCls} {...register("topic")}>
            {TOPICS.map((k) => (
              <option key={k} value={k}>
                {t(`topics.${k}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ct-message" className={labelCls}>
          {t("message")}
        </label>
        <textarea id="ct-message" rows={5} className={textareaCls} {...aria("message")} {...register("message")} />
        {err("message")}
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="ct-website">Website</label>
        <input id="ct-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>
      <Turnstile siteKey={siteKey} onToken={onToken} locale={locale} />
      <button type="submit" disabled={!ready || formState.isSubmitting} className={accentBtn}>
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
