"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { inputCls, labelCls, primaryBtn, selectCls, textareaCls } from "@/components/forms/styles";
import { PROPERTY_STATUSES, TIERS } from "@/lib/constants";
import { formatPriceWords, parsePrice } from "@/lib/price";
import { updateListing } from "../../actions";

export type ListingEdit = {
  id: string;
  titleEn: string;
  titleNe: string;
  titleLocked: boolean;
  status: string;
  tier: string;
  expiresAt: string | null;
  priceNpr: number | null;
  priceOnRequest: boolean;
  negotiable: boolean;
  priceNeedsApproval: boolean;
  descriptionEn: string;
  descriptionNe: string;
  contactName: string;
  contactPhone: string;
};

export function ListingEditor({ initial }: { initial: ListingEdit }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [priceText, setPriceText] = useState(initial.priceNpr ? String(initial.priceNpr) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ListingEdit>(k: K, val: ListingEdit[K]) => setV((s) => ({ ...s, [k]: val }));

  const save = () =>
    start(async () => {
      if (v.status === "DELETED" && initial.status !== "DELETED" && !window.confirm("Delete this listing? Its page will answer 410 Gone.")) return;
      const r = await updateListing({ ...v, status: v.status as never, tier: v.tier as never });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: `Couldn’t save${r.fields?.length ? `: check ${r.fields.join(", ")}` : "."}` });
      if (r.ok) router.refresh();
    });

  const field = (id: string, label: string, el: React.ReactNode) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {el}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5 rounded-2xl border bg-card p-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {field("t-en", "Title (English)", <input id="t-en" value={v.titleEn} maxLength={140} onChange={(e) => set("titleEn", e.target.value)} className={inputCls} />)}
        {field("t-ne", "Title (Nepali)", <input id="t-ne" lang="ne" value={v.titleNe} maxLength={140} onChange={(e) => set("titleNe", e.target.value)} className={inputCls} />)}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={v.titleLocked} onChange={(e) => set("titleLocked", e.target.checked)} className="size-5 accent-[var(--primary)]" />
        Lock title (stop it being regenerated from the details). Changing the English title changes the URL; the old URL redirects.
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        {field(
          "st",
          "Status",
          <select id="st" value={v.status} onChange={(e) => set("status", e.target.value)} className={selectCls}>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>,
        )}
        {field(
          "tr",
          "Tier",
          <select id="tr" value={v.tier} onChange={(e) => set("tier", e.target.value)} className={selectCls}>
            {TIERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>,
        )}
        {field("ex", "Expires on (empty = until sold)", <input id="ex" type="date" value={v.expiresAt ?? ""} onChange={(e) => set("expiresAt", e.target.value || null)} className={inputCls} />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field(
          "pr",
          "Price (NPR)",
          <input
            id="pr"
            inputMode="decimal"
            value={priceText}
            disabled={v.priceOnRequest}
            onChange={(e) => {
              setPriceText(e.target.value);
              set("priceNpr", parsePrice(e.target.value));
            }}
            className={inputCls}
          />,
        )}
        <p className="self-end pb-3 text-sm text-price">{v.priceNpr && !v.priceOnRequest ? formatPriceWords(v.priceNpr) : ""}</p>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.priceOnRequest} onChange={(e) => set("priceOnRequest", e.target.checked)} className="size-5 accent-[var(--primary)]" />
          Price on request
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="size-5 accent-[var(--primary)]" />
          Negotiable
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.priceNeedsApproval} onChange={(e) => set("priceNeedsApproval", e.target.checked)} className="size-5 accent-[var(--primary)]" />
          Flag price as unusual (untick to confirm it)
        </label>
      </div>
      {field("de", "Description (English)", <textarea id="de" rows={5} maxLength={5000} value={v.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} className={textareaCls} />)}
      {field("dn", "Description (Nepali)", <textarea id="dn" lang="ne" rows={5} maxLength={5000} value={v.descriptionNe} onChange={(e) => set("descriptionNe", e.target.value)} className={textareaCls} />)}
      <div className="grid gap-4 md:grid-cols-2">
        {field("cn", "Contact name", <input id="cn" value={v.contactName} maxLength={80} onChange={(e) => set("contactName", e.target.value)} className={inputCls} />)}
        {field("cp", "Contact phone", <input id="cp" type="tel" value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputCls} />)}
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={primaryBtn}>
          Save changes
        </button>
        <p aria-live="polite" className={msg?.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {msg?.text}
        </p>
      </div>
    </form>
  );
}
