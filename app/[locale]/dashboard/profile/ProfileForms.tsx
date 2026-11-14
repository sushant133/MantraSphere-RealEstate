"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, CheckCircle2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { inputCls, labelCls, outlineBtn, primaryBtn, selectCls } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { updateProfile } from "../actions";

type Kind = "INDIVIDUAL_OWNER" | "AGENT" | "AGENCY";

export function ProfileForm({
  initial,
}: {
  initial: { name: string; locale: "en" | "ne"; kind: Kind; agencyName: string; whatsapp: string; viber: string };
}) {
  const t = useTranslations("dashboard");
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await updateProfile({
            name: String(fd.get("name")),
            locale: String(fd.get("locale")) as "en" | "ne",
            kind,
            agencyName: String(fd.get("agencyName") ?? ""),
            whatsapp: String(fd.get("whatsapp") ?? ""),
            viber: String(fd.get("viber") ?? ""),
          });
          setState(r.ok ? "saved" : "error");
        })
      }
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="p-name" className={labelCls}>
            {t("name")}
          </label>
          <input id="p-name" name="name" autoComplete="name" required minLength={2} maxLength={80} defaultValue={initial.name} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="p-locale" className={labelCls}>
            {t("language")}
          </label>
          <select id="p-locale" name="locale" defaultValue={initial.locale} className={selectCls}>
            <option value="en">English</option>
            <option value="ne">नेपाली</option>
          </select>
        </div>
      </div>
      <fieldset className="min-w-0">
        <legend className={labelCls}>{t("accountType")}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(["INDIVIDUAL_OWNER", "AGENT", "AGENCY"] as const).map((k) => (
            <label key={k} className={cn("tap flex cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm", kind === k && "border-primary ring-1 ring-primary")}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="size-4 accent-[var(--primary)]" />
              {t(`kinds.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "AGENCY" ? (
        <div className="space-y-1.5">
          <label htmlFor="p-agency" className={labelCls}>
            {t("agencyName")}
          </label>
          <input id="p-agency" name="agencyName" maxLength={120} defaultValue={initial.agencyName} className={inputCls} />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="p-wa" className={labelCls}>
            {t("whatsapp")}
          </label>
          <input id="p-wa" name="whatsapp" type="tel" inputMode="tel" defaultValue={initial.whatsapp} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="p-viber" className={labelCls}>
            {t("viber")}
          </label>
          <input id="p-viber" name="viber" type="tel" inputMode="tel" defaultValue={initial.viber} className={inputCls} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {t("save")}
        </button>
        <span aria-live="polite" className="text-sm">
          {state === "saved" ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-4" aria-hidden="true" />{t("saved")}</span> : null}
          {state === "error" ? <span className="text-destructive">{t("saveError")}</span> : null}
        </span>
      </div>
    </form>
  );
}

const DOC_KINDS = ["CITIZENSHIP", "AGENCY_REGISTRATION", "PAN", "OTHER"] as const;

export function VerificationUpload({ status, note, count }: { status: "NONE" | "PENDING" | "APPROVED" | "REJECTED"; note: string; count: number }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [kind, setKind] = useState<(typeof DOC_KINDS)[number]>("CITIZENSHIP");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await fetch("/api/uploads/verification", { method: "POST", body: fd }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: "network" };
    setBusy(false);
    if (res?.ok) {
      setMsg({ ok: true, text: t("docUploaded") });
      router.refresh();
    } else setMsg({ ok: false, text: t("uploadError", { reason: data.error ?? "network" }) });
  };

  return (
    <div className="space-y-4">
      <p className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold", status === "APPROVED" ? "bg-success/15 text-success" : status === "REJECTED" ? "bg-destructive/10 text-destructive" : "bg-muted")}>
        {status === "APPROVED" ? <BadgeCheck className="size-4" aria-hidden="true" /> : null}
        {t(`verification.${status}`, { note })}
      </p>
      {count ? <p className="text-sm text-muted-foreground">{t("docsOnFile", { count })}</p> : null}
      {status !== "APPROVED" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="doc-kind" className={labelCls}>
              {t("documentType")}
            </label>
            <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={selectCls}>
              {DOC_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`docKind.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <label className={cn(outlineBtn, "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring", busy && "pointer-events-none opacity-60")}>
            <Upload className="size-4" aria-hidden="true" />
            {t("uploadDoc")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("docHint")}</p>
      <p aria-live="polite" className={cn("text-sm", msg?.ok ? "text-success" : "text-destructive")}>
        {msg?.text}
      </p>
    </div>
  );
}
