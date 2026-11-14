import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IntlScope } from "@/components/IntlScope";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MiniMap } from "@/components/property/MiniMap";
import type { Locale } from "@/lib/constants";
import { formatPhoneDisplay, telHref, whatsappHref } from "@/lib/phone";
import { toDevanagariDigits } from "@/lib/price";
import { pageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site";
import { turnstileSiteKey } from "@/lib/turnstile";
import { ContactForm } from "./ContactForm";

export const revalidate = 3600;
type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.contact" });
  return pageMetadata({ locale, path: "/contact", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, s] = await Promise.all([getTranslations({ locale, namespace: "pages.contact" }), getSiteSettings()]);
  const num = (v: string) => (locale === "ne" ? toDevanagariDigits(v) : v);
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${s.geo.lat}&mlon=${s.geo.lng}#map=16/${s.geo.lat}/${s.geo.lng}`;

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title") }]} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="ct-form-title" className="rounded-3xl border bg-card p-6 lg:col-span-7">
          <h2 id="ct-form-title" className="text-xl font-semibold">
            {t("formTitle")}
          </h2>
          <div className="mt-4">
            <IntlScope namespaces={["pages"]}>
              <ContactForm locale={locale} siteKey={turnstileSiteKey()} />
            </IntlScope>
          </div>
        </section>

        <section aria-labelledby="ct-office-title" className="space-y-6 lg:col-span-5">
          <div className="rounded-3xl border bg-card p-6">
            <h2 id="ct-office-title" className="text-xl font-semibold">
              {t("officeTitle")}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="sr-only">{t("address")}: </span>
                  {s.address[locale]}
                </span>
              </li>
              {s.phones.map((p) => (
                <li key={p}>
                  <a href={telHref(p)} className="tap -my-2 inline-flex items-center gap-3 hover:underline">
                    <Phone className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="sr-only">{t("call")}: </span>
                    <span dir="ltr">{num(formatPhoneDisplay(p))}</span>
                  </a>
                </li>
              ))}
              {s.whatsapp ? (
                <li>
                  <a href={whatsappHref(s.whatsapp, t("whatsappHello"))} target="_blank" rel="noopener" className="tap -my-2 inline-flex items-center gap-3 hover:underline">
                    <MessageCircle className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    {t("whatsapp")}
                  </a>
                </li>
              ) : null}
              <li>
                <a href={`mailto:${s.email}`} className="tap -my-2 inline-flex items-center gap-3 hover:underline">
                  <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  {s.email}
                </a>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{t("hours")}: </span>
                  {s.officeHours[locale]}
                </span>
              </li>
            </ul>
          </div>
          <MiniMap lat={s.geo.lat} lng={s.geo.lng} label={t("mapLabel")} />
          <a href={mapsUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            {t("openMap")}
          </a>
        </section>
      </div>
    </div>
  );
}
