import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/constants";
import {
  AREA_UNITS,
  FACING_SLUGS,
  FURNISHING_SLUGS,
  POSTED_WITHIN,
  PURPOSE_SLUGS,
  TYPE_SLUGS,
  type Filters,
} from "@/lib/properties/filters";
import type { LocationIndex, ResolvedNames } from "@/lib/properties/queries";
import { PriceRange } from "./PriceRange";

export const FILTER_FORM_ID = "filters";

const selectCls =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
const inputCls = selectCls;

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * The one and only filter form (fix #11). Plain GET to /properties so every
 * filter state has a real URL (fix #10). FiltersShell adds instant apply.
 */
export async function FilterForm({
  locale,
  f,
  locations,
  names,
}: {
  locale: Locale;
  f: Filters;
  locations: LocationIndex;
  names: ResolvedNames;
}) {
  const t = await getTranslations({ locale, namespace: "search" });
  const tp = await getTranslations({ locale, namespace: "property" });
  const action = getPathname({ href: "/properties", locale });
  const id = FILTER_FORM_ID;
  const district = names.district;
  const municipalities = district ? locations.municipalities.filter((m) => m.districtId === district.id) : [];
  const districts = names.province ? locations.districts.filter((d) => d.provinceId === names.province!.id) : locations.districts;
  const defaultUnit = f.aunit ?? (district?.region === "TERAI" ? "kattha" : f.type === "land" ? "aana" : "sqft");
  const isRent = f.purpose === "rent" || f.purpose === "lease";
  const showRooms = !f.type || ["house", "flat", "bungalow"].includes(f.type);
  const showRoad = f.type !== "flat" && f.type !== "office";

  return (
    <form id={id} action={action} method="get" className="space-y-5" aria-label={t("filters")}>
      {/* Preserve non-filter state */}
      {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
      {f.view !== "grid" ? <input type="hidden" name="view" value={f.view} /> : null}
      {f.status ? <input type="hidden" name="status" value={f.status} /> : null}
      {f.tier ? <input type="hidden" name="tier" value={f.tier} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-purpose`} label={t("purpose")}>
          <select id={`${id}-purpose`} name="purpose" defaultValue={f.purpose ?? ""} className={selectCls}>
            <option value="">{t("anyPurpose")}</option>
            {(Object.keys(PURPOSE_SLUGS) as (keyof typeof PURPOSE_SLUGS)[]).map((k) => (
              <option key={k} value={k}>
                {tp(`purpose.${PURPOSE_SLUGS[k]}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-type`} label={t("type")}>
          <select id={`${id}-type`} name="type" defaultValue={f.type ?? ""} className={selectCls}>
            <option value="">{t("anyType")}</option>
            {(Object.keys(TYPE_SLUGS) as (keyof typeof TYPE_SLUGS)[]).map((k) => (
              <option key={k} value={k}>
                {t(`typePlural.${TYPE_SLUGS[k]}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="min-w-0 space-y-3">
        <legend className="sr-only">{tp("location")}</legend>
        <Field id={`${id}-province`} label={t("province")}>
          <select id={`${id}-province`} name="province" defaultValue={f.province ?? ""} className={selectCls}>
            <option value="">{t("anyProvince")}</option>
            {locations.provinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p[locale]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-district`} label={t("district")}>
          <select id={`${id}-district`} name="district" defaultValue={district?.slug ?? ""} className={selectCls}>
            <option value="">{t("anyDistrict")}</option>
            {districts.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d[locale]}
              </option>
            ))}
          </select>
        </Field>
        {municipalities.length ? (
          <Field id={`${id}-municipality`} label={t("municipality")}>
            <select id={`${id}-municipality`} name="municipality" defaultValue={names.municipality?.slug ?? ""} className={selectCls}>
              <option value="">{t("anyMunicipality")}</option>
              {municipalities.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m[locale]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </fieldset>

      <PriceRange
        key={`${isRent}-${f.min ?? ""}-${f.max ?? ""}`}
        form={id}
        rent={isRent}
        min={f.min}
        max={f.max}
        locale={locale}
        labels={{ price: t("price"), min: t("minPrice"), max: t("maxPrice"), noMin: t("noMin"), noMax: t("noMax") }}
      />

      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold">{t("areaRange")}</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${id}-amin`} className="sr-only">
              {t("areaMin")}
            </label>
            <input id={`${id}-amin`} name="amin" type="number" inputMode="decimal" min={0} step="any" placeholder={t("noMin")} defaultValue={f.amin ?? ""} className={inputCls} />
          </div>
          <div>
            <label htmlFor={`${id}-amax`} className="sr-only">
              {t("areaMax")}
            </label>
            <input id={`${id}-amax`} name="amax" type="number" inputMode="decimal" min={0} step="any" placeholder={t("noMax")} defaultValue={f.amax ?? ""} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label htmlFor={`${id}-aunit`} className="sr-only">
              {t("areaUnit")}
            </label>
            <select id={`${id}-aunit`} name="aunit" defaultValue={defaultUnit} className={selectCls}>
              {(Object.keys(AREA_UNITS) as (keyof typeof AREA_UNITS)[]).map((u) => (
                <option key={u} value={u}>
                  {t(`units.${u}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {showRooms ? (
        <div className="grid grid-cols-2 gap-3">
          {(["beds", "baths"] as const).map((k) => (
            <Field key={k} id={`${id}-${k}`} label={k === "beds" ? t("bedrooms") : t("bathrooms")}>
              <select id={`${id}-${k}`} name={k} defaultValue={f[k] ?? ""} className={selectCls}>
                <option value="">{t("any")}</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {t("countPlus", { count: n })}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      ) : null}

      {showRoad ? (
        <>
          <Field id={`${id}-facing`} label={t("facing")}>
            <select id={`${id}-facing`} name="facing" defaultValue={f.facing ?? ""} className={selectCls}>
              <option value="">{t("any")}</option>
              {Object.entries(FACING_SLUGS).map(([slug, v]) => (
                <option key={slug} value={slug}>
                  {tp(`facing.${v}`)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-road`} label={t("roadWidth")}>
              <select id={`${id}-road`} name="road" defaultValue={f.road ?? ""} className={selectCls}>
                <option value="">{t("any")}</option>
                {[8, 12, 13, 16, 20, 25, 30].map((n) => (
                  <option key={n} value={n}>
                    {t("feet", { count: n })}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`${id}-mrd`} label={t("mainRoad")}>
              <select id={`${id}-mrd`} name="mrd" defaultValue={f.mrd ?? ""} className={selectCls}>
                <option value="">{t("any")}</option>
                {[50, 100, 250, 500, 1000, 2000].map((n) => (
                  <option key={n} value={n}>
                    {n >= 1000 ? t("km", { count: n / 1000 }) : t("metres", { count: n })}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </>
      ) : null}

      {f.type !== "land" ? (
        <Field id={`${id}-furnishing`} label={t("furnishing")}>
          <select id={`${id}-furnishing`} name="furnishing" defaultValue={f.furnishing ?? ""} className={selectCls}>
            <option value="">{t("any")}</option>
            {(Object.keys(FURNISHING_SLUGS) as (keyof typeof FURNISHING_SLUGS)[]).map((k) => (
              <option key={k} value={k}>
                {t(`furnish.${k}`)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-por`} label={t("priceOnRequest")}>
          <select id={`${id}-por`} name="por" defaultValue={f.por ?? ""} className={selectCls}>
            <option value="">{t("porAll")}</option>
            <option value="only">{t("porOnly")}</option>
            <option value="exclude">{t("porExclude")}</option>
          </select>
        </Field>
        <Field id={`${id}-within`} label={t("postedWithin")}>
          <select id={`${id}-within`} name="within" defaultValue={f.within ?? ""} className={selectCls}>
            <option value="">{t("any")}</option>
            {POSTED_WITHIN.map((d) => (
              <option key={d} value={d}>
                {t(`within.${d}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {f.type !== "land" ? (
        <label className="tap flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="parking" value="1" defaultChecked={!!f.parking} className="size-5 accent-[var(--primary)]" />
          {t("parking")}
        </label>
      ) : null}

      <div className="flex items-center gap-3 border-t pt-4">
        <button type="submit" className="tap flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          {t("showResults")}
        </button>
        <Link href="/properties" className="tap inline-flex items-center rounded-xl px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline">
          {t("clearAll")}
        </Link>
      </div>
    </form>
  );
}
