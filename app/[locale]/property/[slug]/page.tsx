import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Calculator, CheckCircle2, MapPin, View } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/JsonLd";
import { IntlScope } from "@/components/IntlScope";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ContactCard } from "@/components/property/ContactCard";
import { EnquiryForm } from "@/components/property/EnquiryForm";
import { Gallery } from "@/components/property/Gallery";
import { KeyFacts } from "@/components/property/KeyFacts";
import { MiniMap } from "@/components/property/MiniMap";
import { PropertyCard } from "@/components/property/PropertyCard";
import { ReportListing } from "@/components/property/ReportListing";
import { CompareButton } from "@/components/property/CompareButton";
import { SaveButton } from "@/components/property/SaveButton";
import { ShareButtons } from "@/components/property/ShareButtons";
import { VideoEmbed } from "@/components/property/VideoEmbed";
import { ViewBeacon } from "@/components/property/ViewBeacon";
import type { Locale } from "@/lib/constants";
import { landingSlug } from "@/lib/properties/filters";
import {
  displayArea,
  displayPrice,
  impliedUnitRate,
  localDigits,
  placeLine,
} from "@/lib/properties/format";
import { listingJsonLd } from "@/lib/properties/jsonld";
import {
  getLocationIndex,
  getPropertyDetail,
  getSimilar,
} from "@/lib/properties/queries";
import { absoluteUrl, clamp, pageMetadata } from "@/lib/seo";
import { turnstileSiteKey } from "@/lib/turnstile";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

// Statically rendered on first request, revalidated hourly or on edit via revalidateTag(`property:${slug}`).
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getPropertyDetail(slug);
  if (!p)
    return {
      title: { absolute: "404 – Page not found | पृष्ठ फेला परेन" },
      robots: { index: false },
    };
  const tc = await getTranslations({ locale, namespace: "common" });
  const price = displayPrice(p, locale);
  const priceText = price
    ? `${price.main}${price.suffix ? ` ${price.suffix}` : ""}`
    : tc("priceOnRequest");
  const title =
    `${p.title[locale]} – ${priceText}`.length <= 60
      ? `${p.title[locale]} – ${priceText}`
      : p.title[locale];
  const area = displayArea(p, locale);
  const desc = [
    priceText,
    area,
    placeLine(p.locationNames, p.address, locale),
    p.code,
    p.description[locale] || p.description.en,
  ]
    .filter(Boolean)
    .join(" · ");
  return pageMetadata({
    locale,
    path: `/property/${p.slug}`,
    title,
    description: clamp(desc, 155),
  });
}

export default async function PropertyPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const p = await getPropertyDetail(slug);
  if (!p) notFound();

  const [t, tp, tc, ts, similar, locations] = await Promise.all([
    getTranslations({ locale, namespace: "detail" }),
    getTranslations({ locale, namespace: "property" }),
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "search" }),
    getSimilar(p),
    getLocationIndex(),
  ]);
  const region = (locations.districts.find((d) => d.id === p.districtId)
    ?.region ?? "HILL") as "HILL" | "TERAI";
  const price = displayPrice(p, locale);
  const rate = impliedUnitRate(p, locale);
  const url = absoluteUrl(locale, `/property/${p.slug}`);
  const title = p.title[locale];
  const active = p.status === "ACTIVE";
  const closed = p.status === "SOLD" || p.status === "RENTED";
  const purposeSlug = p.purpose.toLowerCase() as "sale" | "rent" | "lease";
  const districtLanding = `/${landingSlug({ purpose: purposeSlug, district: p.locationNames.district.slug })}`;
  const description = p.description[locale] || p.description.en;
  const video = p.videos.find((v) => v.kind === "YOUTUBE");
  const tour = p.videos.find((v) => v.kind === "TOUR_360");
  const siteKey = turnstileSiteKey();

  return (
    <IntlScope namespaces={["common", "property", "detail"]}>
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs
          locale={locale}
          items={[
            { name: t("properties"), href: "/properties" },
            {
              name: ts("headingPurpose", {
                type: ts("typePlural.ALL"),
                purpose: ts(`purposeWord.${purposeSlug}`),
                place: p.locationNames.district[locale],
              }),
              href: districtLanding,
            },
            { name: title },
          ]}
        />

        <div className="mt-4 grid gap-8 lg:grid-cols-12">
          {/* Gallery + headline */}
          <div className="min-w-0 lg:col-span-8">
            <Gallery images={p.images} title={title} />
            <header className="mt-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  {tp(`purpose.${p.purpose}`)}
                </span>
                {p.tier !== "NORMAL" ? (
                  <span className="rounded-full bg-saffron px-3 py-1 text-xs font-bold text-saffron-foreground">
                    {tp(`tier.${p.tier}`)}
                  </span>
                ) : null}
                {closed ? (
                  <span className="rounded-full bg-destructive px-3 py-1 text-xs font-bold uppercase text-white">
                    {tp(`status.${p.status as "SOLD" | "RENTED"}`)}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {tp("code")}: <span className="font-mono">{p.code}</span>
                </span>
              </div>
              <h1 className="mt-3 text-balance text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {placeLine(p.locationNames, p.address, locale)}
              </p>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  {price ? (
                    <>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-3xl font-bold tracking-tight text-price">
                          {price.main}
                        </span>
                        {price.suffix ? (
                          <span className="text-base font-medium text-muted-foreground">
                            {price.suffix}
                          </span>
                        ) : null}
                        {p.negotiable ? (
                          <span className="rounded-md bg-success/10 px-2 py-0.5 text-sm font-semibold text-success">
                            {tc("negotiable")}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {price.words}
                        {rate
                          ? ` · ${t("perUnitApprox", { price: rate.price, unit: rate.unit })}`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold text-price">
                      {tc("priceOnRequest")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {active ? <CompareButton code={p.code} variant="inline" labels={{ compare: tp("compare"), comparing: tp("comparing") }} /> : null}
                  <SaveButton
                    code={p.code}
                    labels={{ save: tp("save"), unsave: tp("unsave") }}
                    className="border"
                  />
                </div>
              </div>
              {active && p.purpose === "SALE" && p.priceTotalNpr ? (
                <Link
                  href={`/tools/emi-calculator?amount=${p.priceTotalNpr}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  <Calculator className="size-4" aria-hidden="true" />
                  {t("emiLink")}
                </Link>
              ) : null}
              {closed ? (
                <p className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
                  {p.status === "SOLD" ? t("soldNotice") : t("rentedNotice")}{" "}
                  <Link
                    href={districtLanding}
                    className="underline underline-offset-4"
                  >
                    {t("seeAvailable", {
                      place: p.locationNames.district[locale],
                    })}
                  </Link>
                </p>
              ) : null}
            </header>
          </div>

          {/* Contact: second on mobile, sticky sidebar on desktop */}
          <aside className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
            <div className="space-y-5 lg:sticky lg:top-24">
              <section
                aria-labelledby="contact-title"
                className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <h2 id="contact-title" className="sr-only">
                  {t("contact")}
                </h2>
                <ContactCard
                  code={p.code}
                  title={title}
                  url={url}
                  contactName={p.contactName}
                  postedBy={p.postedBy}
                  verified={p.ownerVerified}
                  hasViber={p.hasViber}
                  locale={locale}
                  active={active}
                />
              </section>
              {active ? (
                <section
                  aria-labelledby="enquiry-title"
                  className="rounded-2xl border bg-card p-5"
                >
                  <h2 id="enquiry-title" className="mb-3 text-lg font-semibold">
                    {t("enquiryTitle")}
                  </h2>
                  <EnquiryForm
                    code={p.code}
                    locale={locale}
                    siteKey={siteKey}
                  />
                </section>
              ) : null}
            </div>
          </aside>

          {/* Details */}
          <div className="min-w-0 space-y-10 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
              <ShareButtons url={url} title={title} />
              <ReportListing code={p.code} locale={locale} siteKey={siteKey} />
            </div>

            <section aria-labelledby="facts-title">
              <h2
                id="facts-title"
                className="mb-4 text-xl font-semibold text-primary"
              >
                {t("keyFacts")}
              </h2>
              <KeyFacts p={p} locale={locale} region={region} />
            </section>

            {description ? (
              <section aria-labelledby="desc-title">
                <h2
                  id="desc-title"
                  className="mb-3 text-xl font-semibold text-primary"
                >
                  {t("description")}
                </h2>
                <div className="whitespace-pre-line text-pretty leading-relaxed text-foreground/90">
                  {description}
                </div>
              </section>
            ) : null}

            {p.amenities.length ? (
              <section aria-labelledby="amen-title">
                <h2
                  id="amen-title"
                  className="mb-3 text-xl font-semibold text-primary"
                >
                  {t("amenities")}
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {p.amenities.map((a) => (
                    <li
                      key={a.slug}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle2
                        className="size-4 text-success"
                        aria-hidden="true"
                      />
                      {a.name[locale]}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {video || tour ? (
              <section aria-labelledby="video-title" className="space-y-3">
                <h2
                  id="video-title"
                  className="text-xl font-semibold text-primary"
                >
                  {t("videoTour")}
                </h2>
                {video ? (
                  <VideoEmbed
                    url={video.url}
                    title={title}
                    playLabel={t("playVideo", { title })}
                  />
                ) : null}
                {tour ? (
                  <a
                    href={tour.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap inline-flex items-center gap-2 rounded-xl border px-4 text-sm font-semibold hover:bg-muted"
                  >
                    <View className="size-4" aria-hidden="true" />
                    {t("tour360")}
                  </a>
                ) : null}
              </section>
            ) : null}

            {p.nearby.length ? (
              <section aria-labelledby="nearby-title">
                <h2
                  id="nearby-title"
                  className="mb-3 text-xl font-semibold text-primary"
                >
                  {t("nearby")}
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {p.nearby.map((n) => (
                    <li
                      key={`${n.kind}-${n.name}`}
                      className="flex justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
                    >
                      <span>
                        <span className="text-muted-foreground">
                          {t(`nearbyKind.${n.kind}` as "nearbyKind.OTHER")}
                          :{" "}
                        </span>
                        {n.name}
                      </span>
                      {n.distanceM != null ? (
                        <span className="font-medium">
                          {t("metres", {
                            count: localDigits(String(n.distanceM), locale),
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {p.coordinates ? (
              <section aria-labelledby="map-title">
                <h2
                  id="map-title"
                  className="mb-3 text-xl font-semibold text-primary"
                >
                  {t("location")}
                </h2>
                <MiniMap
                  lng={p.coordinates[0]}
                  lat={p.coordinates[1]}
                  label={t("location")}
                />
                <a
                  href={`https://www.openstreetmap.org/?mlat=${p.coordinates[1]}&mlon=${p.coordinates[0]}#map=16/${p.coordinates[1]}/${p.coordinates[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap mt-2 inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("openInOsm")}
                </a>
              </section>
            ) : null}
          </div>
        </div>

        {similar.length ? (
          <section aria-labelledby="similar-title" className="mt-16">
            <h2
              id="similar-title"
              className="mb-5 text-2xl font-semibold tracking-tight text-primary"
            >
              {t("similar")}
            </h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((s) => (
                <li key={s.id} className="flex">
                  <PropertyCard
                    p={s}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <JsonLd data={listingJsonLd(p, locale)} />
        {active ? <ViewBeacon code={p.code} /> : null}
      </div>
    </IntlScope>
  );
}
