"use client";

import { useState, useTransition } from "react";
import { inputCls, labelCls, primaryBtn, textareaCls } from "@/components/forms/styles";
import type { SiteSettingsInput } from "@/lib/admin/settings-schema";
import { saveSettings } from "../actions";

export function SettingsForm({ initial }: { initial: SiteSettingsInput }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (path: string, val: unknown) =>
    setV((s) => {
      const next = structuredClone(s) as Record<string, unknown>;
      const keys = path.split(".");
      let o = next;
      for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
      o[keys.at(-1)!] = val;
      return next as SiteSettingsInput;
    });

  const text = (id: string, label: string, path: string, value: string, opts: { lang?: string; type?: string; area?: boolean } = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {opts.area ? (
        <textarea id={id} lang={opts.lang} rows={6} value={value} onChange={(e) => set(path, e.target.value)} className={textareaCls} />
      ) : (
        <input id={id} lang={opts.lang} type={opts.type ?? "text"} value={value} onChange={(e) => set(path, e.target.value)} className={inputCls} />
      )}
    </div>
  );
  const pair = (id: string, label: string, path: "companyName" | "address" | "officeHours" | "about", area = false) => (
    <div className="grid gap-4 md:grid-cols-2">
      {text(`${id}-en`, `${label} (English)`, `${path}.en`, v[path].en, { area })}
      {text(`${id}-ne`, `${label} (Nepali)`, `${path}.ne`, v[path].ne, { lang: "ne", area })}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettings(v);
          setMsg(r.ok ? { ok: true, text: "Saved. The site header, footer and contact details update right away." } : { ok: false, text: `Couldn’t save: check ${r.fields?.join(", ") || "the form"}.` });
        });
      }}
      className="space-y-8"
    >
      <fieldset className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
        <legend className="px-1 font-semibold">Company</legend>
        {pair("cn", "Company name", "companyName")}
        <div className="grid gap-4 md:grid-cols-3">
          {text("legal", "Legal name", "legalName", v.legalName)}
          {text("reg", "Registration no.", "registrationNo", v.registrationNo)}
          {text("pan", "PAN (9 digits)", "panNo", v.panNo)}
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
        <legend className="px-1 font-semibold">Contact (used everywhere on the site)</legend>
        <div className="space-y-1.5">
          <label htmlFor="phones" className={labelCls}>
            Phone numbers (one per line, first is the main number)
          </label>
          <textarea id="phones" rows={3} value={v.phones.join("\n")} onChange={(e) => set("phones", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} className={textareaCls} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {text("wa", "WhatsApp", "whatsapp", v.whatsapp, { type: "tel" })}
          {text("vb", "Viber", "viber", v.viber, { type: "tel" })}
          {text("em", "Email", "email", v.email, { type: "email" })}
        </div>
        {pair("ad", "Address", "address")}
        {pair("oh", "Office hours", "officeHours")}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="lat" className={labelCls}>Office latitude</label>
            <input id="lat" type="number" step="0.000001" value={v.geo.lat} onChange={(e) => set("geo.lat", Number(e.target.value))} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lng" className={labelCls}>Office longitude</label>
            <input id="lng" type="number" step="0.000001" value={v.geo.lng} onChange={(e) => set("geo.lng", Number(e.target.value))} className={inputCls} />
          </div>
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
        <legend className="px-1 font-semibold">Social links (https)</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {(["facebook", "instagram", "youtube", "tiktok", "linkedin"] as const).map((k) => text(`so-${k}`, k[0].toUpperCase() + k.slice(1), `social.${k}`, v.social[k], { type: "url" }))}
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
        <legend className="px-1 font-semibold">Bank accounts for transfers</legend>
        <div className="space-y-1.5">
          <label htmlFor="banks" className={labelCls}>
            One account per line: Bank | Account name | Account number | Branch
          </label>
          <textarea
            id="banks"
            rows={3}
            defaultValue={v.bankAccounts.map((b) => [b.bank, b.accountName, b.accountNumber, b.branch].join(" | ")).join("\n")}
            onChange={(e) =>
              set(
                "bankAccounts",
                e.target.value
                  .split("\n")
                  .map((l) => l.split("|").map((x) => x.trim()))
                  .filter((p) => p[0])
                  .map(([bank = "", accountName = "", accountNumber = "", branch = ""]) => ({ bank, accountName, accountNumber, branch })),
              )
            }
            className={textareaCls}
          />
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
        <legend className="px-1 font-semibold">Home-loan rates (EMI calculator)</legend>
        <div className="space-y-1.5">
          <label htmlFor="loans" className={labelCls}>
            One bank per line: Bank | Interest rate % (leave empty to hide the table)
          </label>
          <textarea
            id="loans"
            rows={4}
            defaultValue={v.loanRates.map((r) => `${r.bank} | ${r.ratePct}`).join("\n")}
            onChange={(e) =>
              set(
                "loanRates",
                e.target.value
                  .split("\n")
                  .map((l) => l.split("|").map((x) => x.trim()))
                  .filter((p) => p[0])
                  .map(([bank = "", rate = ""]) => ({ bank, ratePct: Number(rate.replace("%", "")) })),
              )
            }
            className={textareaCls}
          />
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
        <legend className="px-1 font-semibold">About page (Markdown)</legend>
        {pair("ab", "About text", "about", true)}
      </fieldset>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={primaryBtn}>
          Save settings
        </button>
        <p aria-live="polite" className={msg?.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {msg?.text}
        </p>
      </div>
    </form>
  );
}
