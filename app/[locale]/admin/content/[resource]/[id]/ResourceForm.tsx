"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { inputCls, labelCls, outlineBtn, primaryBtn, selectCls, textareaCls } from "@/components/forms/styles";
import { getResource, type FieldDef } from "@/lib/admin/resources";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { deleteResource, saveResource } from "../../../actions";

type Values = Record<string, unknown>;
type I18n = { en: string; ne: string };

/** Renders any resource's fields from its config (lib/admin/resources.ts). */
export function ResourceForm({ resource, id, initial }: { resource: string; id: string | null; initial: Values }) {
  const def = getResource(resource)!;
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [bad, setBad] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await saveResource(resource, id, v);
      if (!r.ok) {
        setBad(r.fields ?? []);
        setMsg({ ok: false, text: r.error === "duplicate" ? "That slug is already used." : "Please fix the highlighted fields." });
        return;
      }
      setBad([]);
      setMsg({ ok: true, text: "Saved." });
      if (!id && r.id) router.replace(`/admin/content/${resource}/${r.id}`);
      else router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!id || !window.confirm(`Delete this ${def.singular}? This cannot be undone.`)) return;
      const r = await deleteResource(resource, id);
      if (r.ok) router.replace(`/admin/content/${resource}`);
      else setMsg({ ok: false, text: "Couldn’t delete." });
    });

  const upload = async (f: FieldDef, file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!res.ok) return setMsg({ ok: false, text: "Image upload failed (JPEG, PNG or WebP up to 10 MB)." });
    const d = (await res.json()) as { url: string; width: number; height: number };
    const prev = v[f.key] as { alt?: string } | null;
    set(f.key, { ...d, alt: prev?.alt ?? "" });
  };

  const control = (f: FieldDef) => {
    const id_ = `f-${f.key}`;
    const invalid = bad.includes(f.key);
    const val = v[f.key];
    switch (f.type) {
      case "text":
      case "url":
        return <input id={id_} type={f.type === "url" ? "url" : "text"} value={(val as string) ?? ""} maxLength={f.max} aria-invalid={invalid} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />;
      case "slug":
        return (
          <div className="flex gap-2">
            <input id={id_} value={(val as string) ?? ""} aria-invalid={invalid} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
            {"title" in v || "name" in v ? (
              <button type="button" className={outlineBtn} onClick={() => set(f.key, slugify(((v.title ?? v.name) as I18n)?.en ?? ""))}>
                From title
              </button>
            ) : null}
          </div>
        );
      case "textarea":
      case "markdown":
        return <textarea id={id_} rows={8} value={(val as string) ?? ""} aria-invalid={invalid} onChange={(e) => set(f.key, e.target.value)} className={textareaCls} />;
      case "i18n":
      case "i18nTextarea": {
        const t = (val as I18n) ?? { en: "", ne: "" };
        const El = f.type === "i18n" ? "input" : "textarea";
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {(["en", "ne"] as const).map((l) => (
              <div key={l}>
                <label htmlFor={`${id_}-${l}`} className="text-xs text-muted-foreground">
                  {l === "en" ? "English" : "Nepali"}
                </label>
                <El
                  id={`${id_}-${l}`}
                  lang={l}
                  {...(f.type === "i18nTextarea" ? { rows: f.key === "body" ? 16 : 5 } : {})}
                  value={t[l]}
                  maxLength={f.max}
                  aria-invalid={invalid}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(f.key, { ...t, [l]: e.target.value })}
                  className={f.type === "i18n" ? inputCls : textareaCls}
                />
              </div>
            ))}
          </div>
        );
      }
      case "number":
        return (
          <input
            id={id_}
            type="number"
            step={f.integer ? 1 : "any"}
            min={f.min}
            max={f.max}
            value={(val as number) ?? ""}
            aria-invalid={invalid}
            onChange={(e) => set(f.key, e.target.value === "" ? null : Number(e.target.value))}
            className={inputCls}
          />
        );
      case "boolean":
        return <input id={id_} type="checkbox" checked={!!val} onChange={(e) => set(f.key, e.target.checked)} className="size-5 accent-[var(--primary)]" />;
      case "select":
        return (
          <select id={id_} value={(val as string) ?? ""} aria-invalid={invalid} onChange={(e) => set(f.key, e.target.value || null)} className={selectCls}>
            {f.nullable ? <option value="">None</option> : null}
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "multiselect": {
        const arr = (val as string[]) ?? [];
        return (
          <div id={id_} role="group" className="flex flex-wrap gap-2">
            {f.options.map((o) => (
              <label key={o.value} className="tap flex items-center gap-2 rounded-xl border px-3 text-sm">
                <input type="checkbox" checked={arr.includes(o.value)} onChange={(e) => set(f.key, e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} className="size-4 accent-[var(--primary)]" />
                {o.label}
              </label>
            ))}
          </div>
        );
      }
      case "date":
        return <input id={id_} type="date" value={(val as string) ?? ""} onChange={(e) => set(f.key, e.target.value || null)} className={inputCls} />;
      case "stringList":
        return <textarea id={id_} rows={5} value={((val as string[]) ?? []).join("\n")} aria-invalid={invalid} onChange={(e) => set(f.key, e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} className={textareaCls} />;
      case "i18nList": {
        const t = (val as { en: string[]; ne: string[] }) ?? { en: [], ne: [] };
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {(["en", "ne"] as const).map((l) => (
              <div key={l}>
                <label htmlFor={`${id_}-${l}`} className="text-xs text-muted-foreground">
                  {l === "en" ? "English" : "Nepali"}
                </label>
                <textarea id={`${id_}-${l}`} lang={l} rows={5} value={t[l].join("\n")} onChange={(e) => set(f.key, { ...t, [l]: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} className={textareaCls} />
              </div>
            ))}
          </div>
        );
      }
      case "image": {
        const img = val as { url: string; alt: string; width: number; height: number } | null;
        return (
          <div className="space-y-2">
            {img ? (
              <div className="relative aspect-[16/9] w-full max-w-md overflow-hidden rounded-xl bg-muted">
                <Image src={img.url} alt="" fill sizes="448px" className="object-cover" unoptimized />
              </div>
            ) : null}
            <input id={id_} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && upload(f, e.target.files[0])} className="text-sm" />
            {img ? (
              <div>
                <label htmlFor={`${id_}-alt`} className="text-xs text-muted-foreground">
                  Image description (alt text)
                </label>
                <input id={`${id_}-alt`} value={img.alt} maxLength={160} onChange={(e) => set(f.key, { ...img, alt: e.target.value })} className={inputCls} />
                <button type="button" onClick={() => set(f.key, null)} className={cn(outlineBtn, "mt-2 h-11 px-3 text-sm")}>
                  Remove image
                </button>
              </div>
            ) : null}
          </div>
        );
      }
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5 rounded-2xl border bg-card p-5"
    >
      {def.fields.map((f) => (
        <div key={f.key} className={cn("space-y-1.5", f.type === "boolean" && "flex items-center gap-3 space-y-0")}>
          <label htmlFor={`f-${f.key}`} className={cn(labelCls, bad.includes(f.key) && "text-destructive")}>
            {f.label}
          </label>
          {control(f)}
          {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>
          Save
        </button>
        {id && def.remove ? (
          <button type="button" disabled={pending} onClick={remove} className={cn(outlineBtn, "text-destructive")}>
            Delete
          </button>
        ) : null}
        <p aria-live="polite" className={msg?.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {msg?.text}
        </p>
      </div>
    </form>
  );
}
