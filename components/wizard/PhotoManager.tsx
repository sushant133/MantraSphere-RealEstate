"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { inputCls } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { removeImage } from "@/app/[locale]/dashboard/actions";
import { compressImage } from "./compress";

export type WizardImage = { id: string; url: string; width: number; height: number; blurDataURL: string; alt: string; isCover: boolean };

/**
 * Drag-and-drop upload, reorder (buttons for keyboard users + drag for
 * mouse/touch), cover pick and required alt text (fix #29).
 */
export function PhotoManager({
  propertyId,
  images,
  onChange,
  max,
}: {
  propertyId: string;
  images: WizardImage[];
  onChange: (next: WizardImage[]) => void;
  max: number;
}) {
  const t = useTranslations("wizard");
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const latest = useRef(images);
  latest.current = images;

  const upload = async (files: File[]) => {
    const list = files.filter((f) => f.size > 0).slice(0, Math.max(0, max - latest.current.length));
    if (!list.length) return;
    setErrors([]);
    setProgress({ done: 0, total: list.length });
    for (const [i, file] of list.entries()) {
      try {
        const blob = await compressImage(file);
        const fd = new FormData();
        fd.set("propertyId", propertyId);
        fd.set("file", blob, file.name.replace(/\.[^.]+$/, "") + (blob === file ? "" : ".jpg"));
        const res = await fetch("/api/uploads/property-image", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { image?: WizardImage; error?: string };
        if (!res.ok || !data.image) {
          const key = ["unsupported_type", "too_large", "too_many"].includes(data.error ?? "") ? data.error! : "failed";
          setErrors((e) => [...e, t(`photoErrors.${key}` as "photoErrors.failed", { name: file.name })]);
        } else {
          onChange([...latest.current, data.image]);
        }
      } catch {
        setErrors((e) => [...e, t("photoErrors.failed", { name: file.name })]);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  const setCover = (id: string) => onChange(images.map((i) => ({ ...i, isCover: i.id === id })));
  const setAlt = (id: string, alt: string) => onChange(images.map((i) => (i.id === id ? { ...i, alt } : i)));
  const remove = async (id: string) => {
    const r = await removeImage(propertyId, id);
    if (r.ok) {
      const next = latest.current.filter((i) => i.id !== id);
      if (next.length && !next.some((i) => i.isCover)) next[0] = { ...next[0], isCover: true };
      onChange(next);
    }
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          upload([...e.dataTransfer.files]);
        }}
        className={cn("flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors", dragOver ? "border-primary bg-navy-50" : "border-input")}
      >
        <ImagePlus className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm">
          {t("drop")}{" "}
          <button type="button" onClick={() => input.current?.click()} className="tap font-semibold text-primary underline-offset-4 hover:underline" disabled={images.length >= max}>
            {t("choose")}
          </button>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("photoHint")}</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            upload([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      <div aria-live="polite" className="space-y-1 text-sm">
        {progress ? <p>{t("uploading", { done: progress.done, total: progress.total })}</p> : null}
        {errors.map((e) => (
          <p key={e} className="text-destructive">
            {e}
          </p>
        ))}
        <p className="text-muted-foreground">
          {t("photoCount", { count: images.length })} · {t("photosLimit", { count: max })}
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2">
        {images.map((img, i) => (
          <li
            key={img.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => dragIndex !== null && e.preventDefault()}
            onDrop={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn("rounded-2xl border bg-card p-3", img.isCover && "ring-2 ring-saffron")}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
              <Image src={img.url} alt="" fill sizes="(min-width: 640px) 320px, 100vw" className="object-cover" />
              {img.isCover ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-saffron px-2 py-0.5 text-xs font-bold text-saffron-foreground">
                  <Star className="size-3" aria-hidden="true" />
                  {t("cover")}
                </span>
              ) : null}
            </div>
            <label htmlFor={`alt-${img.id}`} className="mt-3 block text-sm font-semibold">
              {t("alt", { n: i + 1 })}
            </label>
            <input
              id={`alt-${img.id}`}
              value={img.alt}
              maxLength={160}
              required
              aria-invalid={img.alt.trim().length < 3}
              aria-describedby={`alt-hint-${img.id}`}
              onChange={(e) => setAlt(img.id, e.target.value)}
              className={cn(inputCls, "mt-1")}
            />
            <p id={`alt-hint-${img.id}`} className="mt-1 text-xs text-muted-foreground">
              {t("altHint")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={t("moveEarlier", { n: i + 1 })} className="tap inline-flex items-center justify-center rounded-lg border disabled:opacity-40">
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label={t("moveLater", { n: i + 1 })} className="tap inline-flex items-center justify-center rounded-lg border disabled:opacity-40">
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              {!img.isCover ? (
                <button type="button" onClick={() => setCover(img.id)} className="tap inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm">
                  <Star className="size-4" aria-hidden="true" />
                  {t("makeCover")}
                </button>
              ) : null}
              <button type="button" onClick={() => remove(img.id)} aria-label={t("removePhoto", { n: i + 1 })} className="tap ml-auto inline-flex items-center justify-center rounded-lg border text-destructive">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
