import Image from "next/image";
import { Bath, BedDouble, Car, Compass, MapPin, Ruler } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/constants";
import type { PropertyCardDTO } from "@/lib/properties/dto";
import { displayArea, displayPrice, localDigits, placeLine } from "@/lib/properties/format";
import { cn } from "@/lib/utils";
import { CompareButton } from "./CompareButton";
import { SaveButton } from "./SaveButton";

/**
 * Listing card. Server-renderable (no "use client") but also importable by
 * client lists (infinite scroll). Only fields relevant to the type are shown
 * and every icon has a visible text label (fix #22).
 */
export function PropertyCard({
  p,
  variant = "grid",
  priority = false,
  headingLevel = 3,
  sizes = "(min-width: 1280px) 300px, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw",
}: {
  p: PropertyCardDTO;
  variant?: "grid" | "list";
  priority?: boolean;
  headingLevel?: 2 | 3;
  sizes?: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("property");
  const tc = useTranslations("common");
  const price = displayPrice(p, locale);
  const area = displayArea(p, locale);
  const closed = p.status === "SOLD" || p.status === "RENTED";
  const H = headingLevel === 2 ? "h2" : "h3";
  const isList = variant === "list";

  // Visible text for every icon; `srPrefix` adds context for screen readers.
  const facts: { key: string; icon: typeof Ruler; text: string; srPrefix?: string }[] = [];
  if (area) facts.push({ key: "area", icon: Ruler, text: area, srPrefix: `${t("area")}: ` });
  if (p.bedrooms) facts.push({ key: "beds", icon: BedDouble, text: t("beds", { count: p.bedrooms }) });
  if (p.bathrooms) facts.push({ key: "baths", icon: Bath, text: t("baths", { count: p.bathrooms }) });
  if (p.parking) facts.push({ key: "parking", icon: Car, text: t("parking") });
  if (p.facing) {
    const dir = t(`facing.${p.facing}` as "facing.EAST");
    facts.push({ key: "facing", icon: Compass, text: dir, srPrefix: `${t("facingLabel", { dir: "" }).trim()} ` });
  }

  return (
    <article
      className={cn(
        "group relative flex overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] focus-within:shadow-[var(--shadow-card-hover)]",
        isList ? "flex-col sm:flex-row" : "flex-col",
      )}
    >
      <div className={cn("relative shrink-0 overflow-hidden bg-muted", isList ? "aspect-[4/3] sm:w-72" : "aspect-[4/3]")}>
        {p.cover ? (
          <Image
            src={p.cover.url}
            alt={p.cover.alt}
            fill
            sizes={isList ? "(min-width: 640px) 288px, 100vw" : sizes}
            priority={priority}
            placeholder={p.cover.blurDataURL ? "blur" : "empty"}
            blurDataURL={p.cover.blurDataURL || undefined}
            className={cn("object-cover transition-transform duration-300 group-hover:scale-[1.03]", closed && "grayscale-[35%]")}
          />
        ) : null}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {p.tier !== "NORMAL" ? (
            <span className="rounded-full bg-saffron px-2.5 py-1 text-xs font-bold text-saffron-foreground shadow-sm">
              {t(`tier.${p.tier}`)}
            </span>
          ) : null}
          <span className="rounded-full bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
            {t(`purpose.${p.purpose}`)}
          </span>
        </div>
        {closed ? (
          <span className="absolute inset-x-0 bottom-0 bg-destructive/90 py-1.5 text-center text-sm font-bold uppercase tracking-wider text-white">
            {t(`status.${p.status as "SOLD" | "RENTED"}`)}
          </span>
        ) : null}
        <SaveButton code={p.code} labels={{ save: t("save"), unsave: t("unsave") }} className="absolute right-2 top-2 z-10" />
        {!closed ? <CompareButton code={p.code} labels={{ compare: t("compare"), comparing: t("comparing") }} className="absolute bottom-2 right-2 z-10" /> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          {price ? (
            <>
              <span className="text-xl font-bold tracking-tight text-price">{price.main}</span>
              {price.suffix ? <span className="text-sm font-medium text-muted-foreground">{price.suffix}</span> : null}
              {p.negotiable ? (
                <span className="ml-1 rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-semibold text-success">{tc("negotiable")}</span>
              ) : null}
            </>
          ) : (
            <span className="text-lg font-bold text-price">{tc("priceOnRequest")}</span>
          )}
        </p>
        <H className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
          <Link href={`/property/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {p.title[locale]}
          </Link>
        </H>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t("location")}: </span>
          <span className="line-clamp-1">{placeLine(p.locationNames, p.address, locale)}</span>
        </p>
        {facts.length ? (
          <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-3 text-sm text-foreground/85">
            {facts.map(({ key, icon: Icon, text, srPrefix }) => (
              <li key={key} className="inline-flex items-center gap-1.5">
                <Icon className="size-4 text-primary/70" aria-hidden="true" />
                {srPrefix ? <span className="sr-only">{srPrefix}</span> : null}
                <span>{localDigits(text, locale)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t("code")}: <span className="font-mono">{p.code}</span>
        </p>
      </div>
    </article>
  );
}
