"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OwnerLead } from "@/lib/properties/dashboard-queries";
import { formatPhoneDisplay, telHref, whatsappHref } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { updateLeadStatus } from "../actions";

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-saffron/25 text-foreground",
  CONTACTED: "bg-primary/10 text-primary",
  CLOSED: "bg-muted text-muted-foreground",
};

/** One lead with an optimistic status switcher. */
export function LeadRow({ lead, locale, date }: { lead: OwnerLead; locale: "en" | "ne"; date: string }) {
  const t = useTranslations("dashboard");
  const [status, setStatus] = useState(lead.status);
  const [pending, start] = useTransition();

  const change = (next: string) => {
    const prev = status;
    setStatus(next);
    start(async () => {
      const r = await updateLeadStatus(lead.id, next);
      if (!r.ok) setStatus(prev);
    });
  };

  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{lead.name ?? t("anonymous")}</p>
          <p className="text-sm text-muted-foreground">
            {t(`leadSource.${lead.source}` as "leadSource.ENQUIRY_FORM")} · {date} ·{" "}
            {lead.propertySlug ? (
              <Link href={`/property/${lead.propertySlug}`} className="font-mono underline-offset-4 hover:underline">
                {lead.code}
              </Link>
            ) : (
              <span className="font-mono">{lead.code}</span>
            )}
          </p>
          {lead.propertyTitle ? <p className="mt-0.5 line-clamp-1 text-sm">{lead.propertyTitle[locale]}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`lead-${lead.id}`} className="sr-only">
            {t("leadStatusLabel")}
          </label>
          <select
            id={`lead-${lead.id}`}
            value={status}
            disabled={pending}
            onChange={(e) => change(e.target.value)}
            className={cn("h-11 rounded-xl border-0 px-3 text-sm font-semibold", STATUS_STYLE[status])}
          >
            {(["NEW", "CONTACTED", "CLOSED"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`leadStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {lead.message ? <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/60 p-3 text-sm">{lead.message}</p> : null}
      {lead.phone || lead.email ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {lead.phone ? (
            <>
              <a href={telHref(lead.phone)} className="tap inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
                <Phone className="size-4" aria-hidden="true" />
                {t("callBack")} <span dir="ltr">{formatPhoneDisplay(lead.phone)}</span>
              </a>
              <a href={whatsappHref(lead.phone)} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            </>
          ) : null}
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="tap inline-flex items-center rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
              {lead.email}
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
