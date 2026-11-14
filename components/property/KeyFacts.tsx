import { getTranslations } from "next-intl/server";
import { TYPE_FIELDS, type Locale } from "@/lib/constants";
import type { PropertyDetailDTO } from "@/lib/properties/dto";
import { displayArea, displayAreaConverted, formatDate, localDigits } from "@/lib/properties/format";
import { typeLabel } from "@/lib/titles";

/** Labelled key facts; only fields that apply to the property type are shown (fix #22). */
export async function KeyFacts({ p, locale, region }: { p: PropertyDetailDTO; locale: Locale; region: "HILL" | "TERAI" }) {
  const t = await getTranslations({ locale, namespace: "detail" });
  const tp = await getTranslations({ locale, namespace: "property" });
  const n = (v: number) => localDigits(new Intl.NumberFormat("en-IN").format(v), locale);
  const applies = new Set(TYPE_FIELDS[p.type]);
  const rows: [string, string][] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value != null && value !== "") rows.push([label, value]);
  };

  add(t("facts.code"), p.code);
  add(t("facts.purpose"), tp(`purpose.${p.purpose}`));
  add(t("facts.type"), typeLabel(p.type, locale));
  const area = displayArea(p, locale);
  const conv = displayAreaConverted(p, locale, region);
  add(t("facts.area"), area ? (conv && conv !== area ? `${area} (${conv})` : area) : null);
  if (p.builtUpAreaSqFt && p.type !== "LAND") add(t("facts.builtUpArea"), t("sqft", { count: n(p.builtUpAreaSqFt) }));
  if (applies.has("facing") && p.facing) add(t("facts.facing"), tp(`facing.${p.facing}` as "facing.EAST"));
  if (applies.has("roadWidthFt") && p.roadWidthFt) add(t("facts.roadWidth"), t("feet", { count: n(p.roadWidthFt) }));
  if (applies.has("roadType") && p.roadType) add(t("facts.roadType"), t(`roadType.${p.roadType}` as "roadType.PAVED"));
  if (applies.has("mainRoadDistanceM") && p.mainRoadDistanceM != null)
    add(t("facts.mainRoadDistance"), p.mainRoadDistanceM === 0 ? t("onMainRoad") : t("metres", { count: n(p.mainRoadDistanceM) }));
  if (applies.has("floors") && p.floors) add(t("facts.floors"), n(p.floors));
  if (applies.has("bedrooms") && p.bedrooms) add(t("facts.bedrooms"), n(p.bedrooms));
  if (applies.has("kitchens") && p.kitchens) add(t("facts.kitchens"), n(p.kitchens));
  if (applies.has("livingRooms") && p.livingRooms) add(t("facts.livingRooms"), n(p.livingRooms));
  if (applies.has("bathrooms") && p.bathrooms) add(t("facts.bathrooms"), n(p.bathrooms));
  if (applies.has("parking") && p.parking != null) add(t("facts.parking"), t("vehicles", { count: p.parking }));
  if (applies.has("furnishing") && p.furnishing) add(t("facts.furnishing"), t(`furnishing.${p.furnishing}` as "furnishing.UNFURNISHED"));
  if (applies.has("builtYear") && p.builtYear) add(t("facts.builtYear"), localDigits(String(p.builtYear), locale));
  if (applies.has("readyToMove") && p.readyToMove != null) add(t("facts.readyToMove"), p.readyToMove ? t("yes") : t("no"));
  if (applies.has("ownershipType") && p.ownershipType) add(t("facts.ownership"), t(`ownership.${p.ownershipType}` as "ownership.OTHER"));
  add(t("facts.postedOn"), formatDate(p.publishedAt ?? p.createdAt, locale));

  return (
    <dl className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 bg-card px-4 py-3">
          <dt className="text-sm text-muted-foreground">{k}</dt>
          <dd className="text-right text-sm font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
