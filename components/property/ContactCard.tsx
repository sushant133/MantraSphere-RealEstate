"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, MessageCircle, Phone, PhoneCall } from "lucide-react";
import { useTranslations } from "next-intl";
import { revealContact } from "@/app/[locale]/property/[slug]/actions";
import { formatPhoneDisplay, telHref, viberHref, whatsappHref } from "@/lib/phone";
import { localDigits } from "@/lib/properties/format";
import { cn } from "@/lib/utils";

type Channel = "SHOW_NUMBER" | "CALL" | "WHATSAPP" | "VIBER";

/**
 * Contact actions. The number is not in the HTML: it is fetched through a
 * logged, rate-limited server action when the visitor asks for it
 * (fix #15, deters scrapers), then the tel:/wa.me/viber: link opens.
 */
export function ContactCard({
  code,
  title,
  url,
  contactName,
  postedBy,
  verified,
  hasViber,
  locale,
  active,
}: {
  code: string;
  title: string;
  url: string;
  contactName: string;
  postedBy: "OWNER" | "AGENT" | "COMPANY";
  verified: boolean;
  hasViber: boolean;
  locale: "en" | "ne";
  active: boolean;
}) {
  const t = useTranslations("detail");
  const [phone, setPhone] = useState<{ phone: string; whatsapp: string | null; viber: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = (c: Channel, p: NonNullable<typeof phone>) => {
    const msg = t("whatsappMessage", { code, title, url });
    if (c === "CALL") window.location.href = telHref(p.phone);
    if (c === "WHATSAPP" && p.whatsapp) window.open(whatsappHref(p.whatsapp, msg), "_blank", "noopener");
    if (c === "VIBER" && p.viber) window.location.href = viberHref(p.viber);
  };

  const act = (c: Channel) => {
    if (phone) return open(c, phone);
    setError(null);
    start(async () => {
      const r = await revealContact({ code, channel: c });
      if (!r.ok) return setError(r.error === "rate_limited" ? t("tooMany") : t("numberError"));
      const p = { phone: r.phone, whatsapp: r.whatsapp, viber: r.viber };
      setPhone(p);
      open(c, p);
    });
  };

  const btn = "tap inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60";

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy-50 text-lg font-bold text-primary" aria-hidden="true">
          {contactName.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{contactName}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {t(`postedBy.${postedBy}`)}
            {verified ? (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <BadgeCheck className="size-4" aria-hidden="true" />
                {t("verified")}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {active ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => act("CALL")} disabled={pending} className={cn(btn, "col-span-2 bg-primary text-primary-foreground hover:bg-primary/90")}>
              <PhoneCall className="size-4" aria-hidden="true" />
              {t("call")}
            </button>
            <button type="button" onClick={() => act("WHATSAPP")} disabled={pending} className={cn(btn, "bg-[#15703a] text-white hover:bg-[#115f31]")}>
              <MessageCircle className="size-4" aria-hidden="true" />
              {t("whatsapp")}
            </button>
            {hasViber ? (
              <button type="button" onClick={() => act("VIBER")} disabled={pending} className={cn(btn, "bg-[#6f4bb8] text-white hover:bg-[#5f3fa1]")}>
                <Phone className="size-4" aria-hidden="true" />
                {t("viber")}
              </button>
            ) : null}
          </div>
          <div className="mt-3 text-center" aria-live="polite">
            {phone ? (
              <a href={telHref(phone.phone)} className="tap inline-flex items-center gap-2 text-lg font-bold text-primary" dir="ltr">
                <Phone className="size-4" aria-hidden="true" />
                {localDigits(formatPhoneDisplay(phone.phone), locale)}
              </a>
            ) : (
              <button type="button" onClick={() => act("SHOW_NUMBER")} disabled={pending} className={cn(btn, "w-full border hover:bg-muted")}>
                {t("showNumber")}
              </button>
            )}
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
