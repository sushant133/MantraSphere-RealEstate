"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Check, CheckCircle2, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { inputCls, labelCls, outlineBtn, primaryBtn, accentBtn, selectCls, textareaCls } from "@/components/forms/styles";
import { checkListing, saveDraft, submitListing } from "@/app/[locale]/dashboard/actions";
import { FACINGS, FURNISHINGS, OWNERSHIP_TYPES, PROPERTY_TYPES, PURPOSES, ROAD_TYPES, TYPE_FIELDS, type PropertyType, type Purpose } from "@/lib/constants";
import { findConflicts, type Conflict } from "@/lib/properties/conflicts";
import { allowedPriceUnits, type DraftInput, type SubmitIssue } from "@/lib/properties/listing-schema";
import { formatPriceCompact, formatPriceWords, parsePrice, toDevanagariDigits, type PriceUnit } from "@/lib/price";
import { typeLabel } from "@/lib/titles";
import { formatAreaInput, formatConverted, isPositiveArea, type AreaInput } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Combobox } from "./Combobox";
import { PhotoManager, type WizardImage } from "./PhotoManager";
import { useHydrated } from "@/components/forms/useHydrated";

const PinPicker = dynamic(() => import("./PinPicker").then((m) => m.PinPicker), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-2xl bg-muted" />,
});

import { STEPS, type Step } from "./steps";

const ISSUE_STEP: Record<SubmitIssue, Step> = {
  district: "location", municipality: "location", pin: "location", area: "area", price: "price", priceUnit: "price",
  bedrooms: "details", youtube: "details", tour: "details", photosAlt: "photos", photosTooMany: "photos",
  contactName: "contact", contactPhone: "contact", whatsapp: "contact", viber: "contact", plan: "plan",
};

const FACT_KEY: Record<string, string> = {
  facing: "facing", roadWidthFt: "roadWidth", roadType: "roadType", mainRoadDistanceM: "mainRoadDistance", floors: "floors",
  bedrooms: "bedrooms", bathrooms: "bathrooms", kitchens: "kitchens", livingRooms: "livingRooms", parking: "parking",
  furnishing: "furnishing", builtYear: "builtYear", readyToMove: "readyToMove", ownershipType: "ownership",
};

type DistrictOpt = { id: string; en: string; ne: string; region: string; center: [number, number] | null };
type Muni = { id: string; en: string; ne: string; wards: number };
type Plan = { slug: string; name: { en: string; ne: string }; priceNpr: number; durationDays: number | null; maxPhotos: number; facebookPromotionDays: number; features: { en: string[]; ne: string[] } };
type Amenity = { slug: string; en: string; ne: string; appliesTo: string[] };
type SaveState = { status: "idle" | "saving" | "saved" | "error"; at?: string; invalid: string[] };

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function NumInput({ id, value, onChange, min = 0, max, step = 1, suffix }: { id: string; value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode={step < 1 ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          onChange(v == null || Number.isNaN(v) ? null : v);
        }}
        className={cn(inputCls, suffix && "pr-14")}
      />
      {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

export function Wizard(props: {
  id: string;
  code: string;
  locale: "en" | "ne";
  initial: DraftInput;
  initialImages: WizardImage[];
  initialPlanSlug: string | null;
  districts: DistrictOpt[];
  amenities: Amenity[];
  plans: Plan[];
  initialStep: number;
  /** Staff submit without payment (company listings). */
  staff?: boolean;
}) {
  const { id, code, locale } = props;
  const t = useTranslations("wizard");
  const td = useTranslations("detail");
  const tp = useTranslations("property");
  const n = (v: number | string) => (locale === "ne" ? toDevanagariDigits(String(v)) : String(v));

  const [draft, setDraft] = useState<DraftInput>({ ...props.initial, planSlug: props.initialPlanSlug });
  const [images, setImages] = useState<WizardImage[]>(props.initialImages);
  const [step, setStep] = useState<number>(props.initialStep);
  const [save, setSave] = useState<SaveState>({ status: "idle", invalid: [] });
  const [priceOutlier, setPriceOutlier] = useState(false);
  const [munis, setMunis] = useState<Muni[]>([]);
  const [districtCenter, setDistrictCenter] = useState<[number, number] | null>(null);
  const [priceText, setPriceText] = useState(props.initial.priceNpr ? String(props.initial.priceNpr) : "");
  const [review, setReview] = useState<{ issues: SubmitIssue[]; warnings: string[] } | null>(null);
  const [submitting, startSubmit] = useTransition();
  const ready = useHydrated();

  const dirty = useRef(false);
  const [same, setSame] = useState({
    whatsapp: !props.initial.whatsapp || props.initial.whatsapp === props.initial.contactPhone,
    viber: !props.initial.viber || props.initial.viber === props.initial.contactPhone,
  });
  const district = props.districts.find((d) => d.id === draft.districtId) ?? null;
  const terai = district?.region === "TERAI";
  const set = useCallback(<K extends keyof DraftInput>(k: K, v: DraftInput[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    dirty.current = true;
  }, []);

  // ---- Autosave (debounced, never overlapping) ------------------------------------
  const inflight = useRef<Promise<void> | null>(null);
  const latest = useRef({ draft, images });
  latest.current = { draft, images };

  const doSave = useCallback(async () => {
    if (inflight.current) await inflight.current;
    if (!dirty.current) return;
    dirty.current = false;
    setSave((s) => ({ ...s, status: "saving" }));
    const { draft: d, images: imgs } = latest.current;
    const p = (async () => {
      try {
        const r = await saveDraft(id, { ...d, images: imgs.map((i) => ({ id: i.id, alt: i.alt, isCover: i.isCover })) });
        if (r.ok) {
          setSave({ status: "saved", at: r.savedAt, invalid: r.invalid });
          setPriceOutlier(r.priceOutlier);
        } else {
          dirty.current = true;
          setSave((s) => ({ ...s, status: "error" }));
        }
      } catch {
        dirty.current = true;
        setSave((s) => ({ ...s, status: "error" }));
      }
    })();
    inflight.current = p;
    await p;
    inflight.current = null;
  }, [id]);

  useEffect(() => {
    if (!dirty.current) return;
    const h = setTimeout(doSave, 1000);
    return () => clearTimeout(h);
  }, [draft, images, doSave]);

  // Retry failed saves.
  useEffect(() => {
    if (save.status !== "error") return;
    const h = setTimeout(doSave, 5000);
    return () => clearTimeout(h);
  }, [save.status, doSave]);

  // ---- Municipalities for the chosen district ---------------------------------------------
  useEffect(() => {
    if (!draft.districtId) {
      setMunis([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/locations?district=${draft.districtId}`)
      .then((r) => r.json())
      .then((d: { municipalities: Muni[]; center: [number, number] | null }) => {
        if (cancelled) return;
        setMunis(d.municipalities ?? []);
        setDistrictCenter(d.center ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draft.districtId]);

  const goto = async (i: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(next + 1));
    window.history.replaceState(window.history.state, "", url);
    await doSave();
    if (STEPS[next] === "review") {
      const r = await checkListing(id);
      if (r.ok) setReview({ issues: r.issues, warnings: r.warnings });
    }
  };

  useEffect(() => {
    if (STEPS[props.initialStep] === "review") void goto(props.initialStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const conflicts: Conflict[] = useMemo(() => {
    const f = { ...draft, areaInput: draft.areaInput ?? null };
    return [...findConflicts(draft.descriptionEn ?? "", f), ...findConflicts(draft.descriptionNe ?? "", f)];
  }, [draft]);

  const stepName = STEPS[step];
  const plan = props.plans.find((p) => p.slug === draft.planSlug);
  const maxPhotos = plan?.maxPhotos ?? Math.max(...props.plans.map((p) => p.maxPhotos), 10);

  // ---- Step bodies ------------------------------------------------------------------------
  const location = (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="w-purpose" label={t("purpose")}>
          <select id="w-purpose" value={draft.purpose} onChange={(e) => {
            const purpose = e.target.value as Purpose;
            set("purpose", purpose);
            if (purpose !== "SALE") set("priceUnit", "PER_MONTH");
            else if (draft.priceUnit === "PER_MONTH") set("priceUnit", "TOTAL");
          }} className={selectCls}>
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {t(`purposes.${p}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="w-type" label={t("type")}>
          <select id="w-type" value={draft.type} onChange={(e) => set("type", e.target.value as PropertyType)} className={selectCls}>
            {PROPERTY_TYPES.map((p) => (
              <option key={p} value={p}>
                {typeLabel(p, locale)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Combobox
          id="w-district"
          label={t("district")}
          placeholder={t("searchPlaceholder")}
          noMatches={t("noMatches")}
          value={draft.districtId ?? null}
          options={props.districts.map((d) => ({ value: d.id, label: d[locale], hint: locale === "ne" ? d.en : d.ne, keywords: `${d.en} ${d.ne}` }))}
          onChange={(v) => {
            set("districtId", v);
            set("municipalityId", null);
            set("ward", null);
          }}
        />
        <Combobox
          id="w-municipality"
          label={t("municipality")}
          placeholder={draft.districtId ? t("searchPlaceholder") : t("chooseDistrictFirst")}
          noMatches={t("noMatches")}
          disabled={!draft.districtId}
          value={draft.municipalityId ?? null}
          options={munis.map((m) => ({ value: m.id, label: m[locale], hint: locale === "ne" ? m.en : m.ne, keywords: `${m.en} ${m.ne}` }))}
          onChange={(v) => {
            set("municipalityId", v);
            set("ward", null);
          }}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="w-ward" label={t("ward")}>
          <select
            id="w-ward"
            value={draft.ward ?? ""}
            disabled={!draft.municipalityId}
            onChange={(e) => set("ward", e.target.value ? Number(e.target.value) : null)}
            className={selectCls}
          >
            <option value="">{t("wardAny")}</option>
            {Array.from({ length: munis.find((m) => m.id === draft.municipalityId)?.wards ?? 0 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {n(i + 1)}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field id="w-address" label={t("address")} hint={t("addressHint")}>
            <input id="w-address" value={draft.address ?? ""} maxLength={200} onChange={(e) => set("address", e.target.value)} aria-describedby="w-address-hint" className={inputCls} />
          </Field>
        </div>
      </div>
      <fieldset className="min-w-0 space-y-2">
        <legend className={labelCls}>{t("pin")}</legend>
        <p className="text-sm text-muted-foreground">{t("pinHint")}</p>
        <PinPicker
          lat={draft.lat ?? null}
          lng={draft.lng ?? null}
          center={district?.center ?? districtCenter}
          onChange={(lat, lng) => {
            set("lat", lat);
            set("lng", lng);
          }}
          labels={{ map: t("pin"), useMyLocation: t("useMyLocation") }}
        />
        <p className="text-sm" aria-live="polite">
          {draft.lat != null && draft.lng != null ? t("pinSet", { lat: draft.lat.toFixed(5), lng: draft.lng.toFixed(5) }) : t("noPin")}
        </p>
      </fieldset>
    </div>
  );

  const defaultSystem: AreaInput["system"] = ["LAND", "HOUSE", "BUNGALOW"].includes(draft.type) ? (terai ? "BKD" : "RAPD") : "SQFT";
  const area = draft.areaInput ?? null;
  const system = area?.system ?? defaultSystem;
  const emptyArea = (s: AreaInput["system"]): AreaInput =>
    s === "RAPD" ? { system: s, values: { ropani: 0, aana: 0, paisa: 0, daam: 0 } } : s === "BKD" ? { system: s, values: { bigha: 0, kattha: 0, dhur: 0 } } : s === "SQFT" ? { system: s, values: { sqft: 0 } } : { system: s, values: { sqm: 0 } };
  const unitFields: Record<AreaInput["system"], { key: string; max: number; step: number }[]> = {
    RAPD: [{ key: "ropani", max: 10_000, step: 1 }, { key: "aana", max: 15, step: 1 }, { key: "paisa", max: 3, step: 1 }, { key: "daam", max: 3.99, step: 0.25 }],
    BKD: [{ key: "bigha", max: 10_000, step: 1 }, { key: "kattha", max: 19, step: 1 }, { key: "dhur", max: 19.99, step: 0.25 }],
    SQFT: [{ key: "sqft", max: 1e8, step: 1 }],
    SQM: [{ key: "sqm", max: 1e7, step: 0.01 }],
  };
  const areaStep = (
    <div className="space-y-5">
      <Field id="w-system" label={t("system")}>
        <select id="w-system" value={system} onChange={(e) => set("areaInput", emptyArea(e.target.value as AreaInput["system"]))} className={selectCls}>
          {(["RAPD", "BKD", "SQFT", "SQM"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`systems.${s}`)}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="min-w-0">
        <legend className={labelCls}>{draft.type === "LAND" || ["HOUSE", "BUNGALOW"].includes(draft.type) ? t("landArea") : t("floorArea")}</legend>
        <div className={cn("mt-1.5 grid gap-3", unitFields[system].length > 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
          {unitFields[system].map((f) => {
            const cur = (area?.system === system ? area : emptyArea(system)).values as Record<string, number>;
            return (
              <Field key={f.key} id={`w-area-${f.key}`} label={t(`units.${f.key}` as "units.aana")}>
                <NumInput
                  id={`w-area-${f.key}`}
                  value={cur[f.key] || null}
                  max={f.max}
                  step={f.step}
                  onChange={(v) => set("areaInput", { system, values: { ...cur, [f.key]: Math.min(v ?? 0, f.max) } } as AreaInput)}
                />
              </Field>
            );
          })}
        </div>
        {area && isPositiveArea(area) ? (
          <p className="mt-3 text-sm font-medium" aria-live="polite">
            {formatAreaInput(area, locale)} {t("areaTotal", { value: formatConverted(area, locale, terai ? "TERAI" : "HILL") })}
          </p>
        ) : null}
      </fieldset>
      {draft.type !== "LAND" ? (
        <Field id="w-builtup" label={t("builtUp")}>
          <NumInput id="w-builtup" value={draft.builtUpAreaSqFt} onChange={(v) => set("builtUpAreaSqFt", v)} max={1e8} />
        </Field>
      ) : null}
    </div>
  );

  const units = allowedPriceUnits(draft.purpose, draft.type, terai);
  const priceStep = (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={!!draft.priceOnRequest} onChange={(e) => set("priceOnRequest", e.target.checked)} className="size-5 accent-[var(--primary)]" />
        {t("priceOnRequest")}
      </label>
      {!draft.priceOnRequest ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="w-price" label={t("amount")} hint={t("amountHint")}>
              <input
                id="w-price"
                inputMode="decimal"
                value={priceText}
                aria-describedby="w-price-hint w-price-words"
                onChange={(e) => {
                  setPriceText(e.target.value);
                  const v = parsePrice(e.target.value);
                  set("priceNpr", v && v > 0 ? v : null);
                }}
                onBlur={() => draft.priceNpr && setPriceText(String(draft.priceNpr))}
                className={inputCls}
              />
            </Field>
            <Field id="w-unit" label={t("priceUnit")}>
              <select id="w-unit" value={units.includes(draft.priceUnit as PriceUnit) ? draft.priceUnit : units[0]} onChange={(e) => set("priceUnit", e.target.value as PriceUnit)} className={selectCls}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {t(`priceUnits.${u}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p id="w-price-words" className="text-sm font-semibold text-price" aria-live="polite">
            {draft.priceNpr ? `${t("inWords", { words: formatPriceWords(draft.priceNpr, locale) })} · ${formatPriceCompact(draft.priceNpr, locale)}` : ""}
          </p>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={!!draft.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="size-5 accent-[var(--primary)]" />
            {t("negotiable")}
          </label>
          {priceOutlier ? (
            <p className="flex items-start gap-2 rounded-xl bg-saffron/15 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("outlier")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );

  const fields = TYPE_FIELDS[draft.type];
  const selectFor = (k: string): { values: readonly string[]; label: (v: string) => string } | null =>
    k === "facing" ? { values: FACINGS, label: (v) => tp(`facing.${v}` as "facing.EAST") }
      : k === "roadType" ? { values: ROAD_TYPES, label: (v) => td(`roadType.${v}` as "roadType.PAVED") }
        : k === "furnishing" ? { values: FURNISHINGS, label: (v) => td(`furnishing.${v}` as "furnishing.UNFURNISHED") }
          : k === "ownershipType" ? { values: OWNERSHIP_TYPES, label: (v) => td(`ownership.${v}` as "ownership.OTHER") }
            : null;
  const amenityOptions = props.amenities.filter((a) => !a.appliesTo.length || a.appliesTo.includes(draft.type));
  const nearby = draft.nearby ?? [];
  const details = (
    <div className="space-y-8">
      <fieldset className="min-w-0">
        <legend className="text-lg font-semibold text-primary">{t("facts")}</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {fields.map((k) => {
            const sel = selectFor(k);
            const label = td(`facts.${FACT_KEY[k]}` as "facts.facing");
            const val = (draft as Record<string, unknown>)[k];
            if (k === "readyToMove")
              return (
                <Field key={k} id={`w-${k}`} label={label}>
                  <select id={`w-${k}`} value={val == null ? "" : val ? "yes" : "no"} onChange={(e) => set("readyToMove", e.target.value === "" ? null : e.target.value === "yes")} className={selectCls}>
                    <option value="">{t("select")}</option>
                    <option value="yes">{t("yes")}</option>
                    <option value="no">{t("no")}</option>
                  </select>
                </Field>
              );
            if (sel)
              return (
                <Field key={k} id={`w-${k}`} label={label}>
                  <select id={`w-${k}`} value={(val as string) ?? ""} onChange={(e) => set(k as "facing", (e.target.value || null) as DraftInput["facing"])} className={selectCls}>
                    <option value="">{t("select")}</option>
                    {sel.values.map((v) => (
                      <option key={v} value={v}>
                        {sel.label(v)}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            const suffix = k === "roadWidthFt" ? (locale === "ne" ? "फिट" : "ft") : k === "mainRoadDistanceM" ? (locale === "ne" ? "मि." : "m") : undefined;
            return (
              <Field key={k} id={`w-${k}`} label={label}>
                <NumInput id={`w-${k}`} value={val as number | null} step={k === "floors" ? 0.5 : 1} min={k === "builtYear" ? 1900 : 0} max={k === "builtYear" ? 2200 : 100_000} suffix={suffix} onChange={(v) => set(k as "bedrooms", v)} />
              </Field>
            );
          })}
        </div>
      </fieldset>

      {amenityOptions.length ? (
        <fieldset className="min-w-0">
          <legend className="text-lg font-semibold text-primary">{t("amenities")}</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {amenityOptions.map((a) => {
              const on = (draft.amenities ?? []).includes(a.slug);
              return (
                <label key={a.slug} className="tap flex cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => set("amenities", on ? (draft.amenities ?? []).filter((x) => x !== a.slug) : [...(draft.amenities ?? []), a.slug])}
                    className="size-5 accent-[var(--primary)]"
                  />
                  {a[locale]}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="min-w-0 space-y-3">
        <legend className="text-lg font-semibold text-primary">{t("nearby")}</legend>
        {nearby.map((row, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[10rem_1fr_8rem_auto]">
            <Field id={`w-nb-kind-${i}`} label={t("nearbyKind")}>
              <select id={`w-nb-kind-${i}`} value={row.kind} onChange={(e) => set("nearby", nearby.map((r, j) => (j === i ? { ...r, kind: e.target.value as typeof r.kind } : r)))} className={selectCls}>
                {(["SCHOOL", "HOSPITAL", "BUS_STOP", "MARKET", "TEMPLE", "BANK", "OTHER"] as const).map((k) => (
                  <option key={k} value={k}>
                    {td(`nearbyKind.${k}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`w-nb-name-${i}`} label={t("nearbyName")}>
              <input id={`w-nb-name-${i}`} value={row.name} maxLength={120} onChange={(e) => set("nearby", nearby.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} className={inputCls} />
            </Field>
            <Field id={`w-nb-dist-${i}`} label={t("nearbyDistance")}>
              <NumInput id={`w-nb-dist-${i}`} value={row.distanceM} max={100_000} onChange={(v) => set("nearby", nearby.map((r, j) => (j === i ? { ...r, distanceM: v } : r)))} />
            </Field>
            <button type="button" onClick={() => set("nearby", nearby.filter((_, j) => j !== i))} aria-label={t("nearbyRemove", { name: row.name || String(i + 1) })} className="tap inline-flex items-center justify-center rounded-xl border text-destructive">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        {nearby.length < 12 ? (
          <button type="button" onClick={() => set("nearby", [...nearby, { kind: "SCHOOL", name: "", distanceM: null }])} className={outlineBtn}>
            <Plus className="size-4" aria-hidden="true" />
            {t("nearbyAdd")}
          </button>
        ) : null}
      </fieldset>

      <fieldset className="min-w-0 space-y-4">
        <legend className="text-lg font-semibold text-primary">{t("media")}</legend>
        <Field id="w-youtube" label={t("youtube")}>
          <input id="w-youtube" type="url" inputMode="url" value={draft.youtubeUrl ?? ""} onChange={(e) => set("youtubeUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={inputCls} />
        </Field>
        <Field id="w-tour" label={t("tour")}>
          <input id="w-tour" type="url" inputMode="url" value={draft.tourUrl ?? ""} onChange={(e) => set("tourUrl", e.target.value)} className={inputCls} />
        </Field>
      </fieldset>

      <div className="space-y-4">
        <Field id="w-desc-en" label={t("descriptionEn")} hint={t("descriptionHint")}>
          <textarea id="w-desc-en" rows={6} maxLength={5000} value={draft.descriptionEn ?? ""} onChange={(e) => set("descriptionEn", e.target.value)} aria-describedby="w-desc-en-hint w-conflicts" className={textareaCls} />
        </Field>
        <Field id="w-desc-ne" label={t("descriptionNe")}>
          <textarea id="w-desc-ne" lang="ne" rows={6} maxLength={5000} value={draft.descriptionNe ?? ""} onChange={(e) => set("descriptionNe", e.target.value)} aria-describedby="w-conflicts" className={textareaCls} />
        </Field>
        <div id="w-conflicts" aria-live="polite" className="space-y-2">
          {conflicts.map((c) => (
            <p key={`${c.field}-${c.found}`} className="flex items-start gap-2 rounded-xl bg-saffron/15 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("conflict", { field: t(`conflictFields.${c.field}`), found: n(c.found), expected: n(c.expected) })}
            </p>
          ))}
        </div>
      </div>
    </div>
  );

  const photos = (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("photosIntro")}</p>
      <PhotoManager
        propertyId={id}
        images={images}
        max={maxPhotos}
        onChange={(next) => {
          setImages(next);
          dirty.current = true;
        }}
      />
    </div>
  );

  const contact = (
    <div className="space-y-5">
      <p className="text-muted-foreground">{t("contactIntro")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="w-cname" label={t("contactName")}>
          <input id="w-cname" autoComplete="name" value={draft.contactName ?? ""} maxLength={80} onChange={(e) => set("contactName", e.target.value)} className={inputCls} />
        </Field>
        <Field id="w-cphone" label={t("contactPhone")}>
          <input
            id="w-cphone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={draft.contactPhone ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({ ...d, contactPhone: v, whatsapp: same.whatsapp ? v : d.whatsapp, viber: same.viber ? v : d.viber }));
              dirty.current = true;
            }}
            aria-invalid={save.invalid.includes("contactPhone")}
            className={inputCls}
          />
        </Field>
      </div>
      {(["whatsapp", "viber"] as const).map((k) => (
        <div key={k} className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={same[k]}
              onChange={(e) => {
                setSame((s) => ({ ...s, [k]: e.target.checked }));
                set(k, e.target.checked ? (draft.contactPhone ?? "") : "");
              }}
              className="size-5 accent-[var(--primary)]"
            />
            {k === "whatsapp" ? "WhatsApp" : "Viber"}: {t("sameAsPhone")}
          </label>
          {!same[k] ? (
            <Field id={`w-${k}`} label={k === "whatsapp" ? "WhatsApp" : "Viber"}>
              <input id={`w-${k}`} type="tel" inputMode="tel" value={draft[k] ?? ""} onChange={(e) => set(k, e.target.value)} aria-invalid={save.invalid.includes(k)} className={inputCls} />
            </Field>
          ) : null}
        </div>
      ))}
    </div>
  );

  const planStep = (
    <fieldset className="min-w-0 space-y-4">
      <legend className="text-muted-foreground">{t("planIntro")}</legend>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {props.plans.map((p) => {
          const on = draft.planSlug === p.slug;
          return (
            <label key={p.slug} className={cn("relative flex cursor-pointer flex-col rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]", on && "border-primary ring-2 ring-primary")}>
              <input type="radio" name="plan" value={p.slug} checked={on} onChange={() => set("planSlug", p.slug)} className="sr-only" />
              <span className="flex items-center justify-between">
                <span className="text-lg font-bold text-primary">{p.name[locale]}</span>
                {on ? <Check className="size-5 text-primary" aria-hidden="true" /> : null}
              </span>
              <span className="mt-1 text-2xl font-bold text-price">{formatPriceCompact(p.priceNpr, locale)}</span>
              <span className="text-sm text-muted-foreground">{p.durationDays ? t("days", { count: p.durationDays }) : t("untilSold")}</span>
              <ul className="mt-3 space-y-1 text-sm">
                {p.features[locale].map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  const reviewStep = (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t("reviewIntro")}</p>
      <Link href={`/dashboard/listings/${id}/preview`} target="_blank" className={outlineBtn}>
        <ExternalLink className="size-4" aria-hidden="true" />
        {t("preview")}
      </Link>
      {review ? (
        <>
          {review.issues.length ? (
            <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
              <p className="font-semibold text-destructive">{t("issuesTitle")}</p>
              <ul className="mt-2 space-y-1">
                {review.issues.map((i) => (
                  <li key={i}>
                    <button type="button" onClick={() => goto(STEPS.indexOf(ISSUE_STEP[i]))} className="tap text-left text-sm underline underline-offset-4" aria-label={`${t(`issues.${i}`)} — ${t("goToStep", { step: t(`steps.${ISSUE_STEP[i]}`) })}`}>
                      {t(`issues.${i}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              {t("ready")}
            </p>
          )}
          {review.warnings.length ? (
            <div className="rounded-2xl bg-saffron/15 p-4 text-sm">
              <p className="font-semibold">{t("warningsTitle")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {review.warnings.map((w) => {
                  const [key, arg] = w.split(":");
                  return <li key={w}>{t(`warnings.${key}` as "warnings.NO_PHOTOS", { code: arg ?? "" })}</li>;
                })}
              </ul>
            </div>
          ) : null}
          <div>
            <button
              type="button"
              disabled={!ready || submitting || review.issues.length > 0}
              onClick={() =>
                startSubmit(async () => {
                  dirty.current = true;
                  await doSave();
                  const r = await submitListing(id, locale);
                  if (r && !r.ok && r.issues) setReview((v) => ({ issues: r.issues!, warnings: v?.warnings ?? [] }));
                  else if (r && !r.ok) setSave((s) => ({ ...s, status: "error" }));
                })
              }
              className={cn(accentBtn, "w-full sm:w-auto")}
            >
              {submitting ? t("submitting") : props.staff ? t("submitStaff") : t("submit")}
            </button>
            <p className="mt-2 text-sm text-muted-foreground">{t("submitNote")}</p>
          </div>
        </>
      ) : (
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      )}
    </div>
  );

  const bodies: Record<Step, ReactNode> = { location, area: areaStep, price: priceStep, details, photos, contact, plan: planStep, review: reviewStep };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{code}</p>
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t(`steps.${stepName}`)}</h1>
          <p className="text-sm text-muted-foreground">{t("stepOf", { n: n(step + 1), total: n(STEPS.length) })}</p>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {save.status === "saving" ? t("saving") : save.status === "error" ? <span className="text-destructive">{t("saveFailed")}</span> : save.at ? t("savedAt", { time: new Date(save.at).toLocaleTimeString(locale === "ne" ? "ne-NP" : "en-GB", { hour: "2-digit", minute: "2-digit" }) }) : null}
        </p>
      </div>

      <nav aria-label={t("progress")} className="-mx-4 mt-5 overflow-x-auto px-4">
        <ol className="flex gap-1">
          {STEPS.map((s, i) => (
            <li key={s} className="shrink-0">
              <button
                type="button"
                onClick={() => goto(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "tap inline-flex items-center gap-2 rounded-full px-3 text-sm font-medium",
                  i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-navy-50 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-current text-xs">{n(i + 1)}</span>
                {t(`steps.${s}`)}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {save.invalid.length ? (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {t("notSaved", { fields: save.invalid.join(", ") })}
        </p>
      ) : null}

      <section className="mt-6 rounded-3xl border bg-card p-5 sm:p-8" aria-label={t(`steps.${stepName}`)}>
        {bodies[stepName]}
      </section>

      {stepName !== "review" ? (
        <div className="mt-6 flex justify-between gap-3">
          <button type="button" onClick={() => goto(step - 1)} disabled={step === 0} className={outlineBtn}>
            {t("back")}
          </button>
          <button type="button" onClick={() => goto(step + 1)} className={primaryBtn}>
            {t("next")}
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <button type="button" onClick={() => goto(step - 1)} className={outlineBtn}>
            {t("back")}
          </button>
        </div>
      )}
    </div>
  );
}
