import type { Metadata } from "next";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Markdown } from "@/components/content/Markdown";
import { accentBtn, outlineBtn } from "@/components/forms/styles";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Locale } from "@/lib/constants";
import { formatPhoneDisplay, telHref } from "@/lib/phone";
import { toDevanagariDigits } from "@/lib/price";
import { pageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site";

export const revalidate = 3600;
type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.about" });
  return pageMetadata({
    locale,
    path: "/about",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, s] = await Promise.all([
    getTranslations({ locale, namespace: "pages.about" }),
    getSiteSettings(),
  ]);
  const num = (v: string) => (locale === "ne" ? toDevanagariDigits(v) : v);
  // Admin-written text (Settings → About) wins; otherwise the built-in description.
  const custom = (
    locale === "ne" ? s.about?.ne || s.about?.en : s.about?.en
  )?.trim();
  const offers = ["buyers", "owners", "agents", "verified"] as const;

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs locale={locale} items={[{ name: t("title") }]} />
      <div className="mt-4 grid gap-10 lg:grid-cols-12">
        <article className="lg:col-span-8">
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {t("lead", { company: s.companyName[locale] })}
          </p>
          {custom ? (
            <Markdown
              source={custom}
              lang={locale === "ne" && !s.about?.ne ? "en" : undefined}
              className="mt-8"
            />
          ) : (
            <div className="md mt-8">
              <p>{t("body1", { legal: s.legalName })}</p>
              <h2>{t("offerTitle")}</h2>
              <ul>
                {offers.map((k) => (
                  <li key={k}>{t(`offer.${k}`)}</li>
                ))}
              </ul>
              <h2>{t("promiseTitle")}</h2>
              <p>{t("promise")}</p>
            </div>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/properties" className={accentBtn}>
              {t("browse")}
            </Link>
            <Link href="/dashboard/post" className={outlineBtn}>
              {t("post")}
            </Link>
          </div>
        </article>

        <aside className="lg:col-span-4">
          <div className="rounded-3xl border bg-card p-6">
            <h2 className="text-lg font-semibold text-primary">
              {t("factsTitle")}
            </h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="flex items-center gap-2 font-semibold">
                  <Building2
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {t("legalName")}
                </dt>
                <dd className="pl-6">{s.legalName}</dd>
                {s.registrationNo ? (
                  <dd className="pl-6 text-muted-foreground">
                    {t("regNo", { no: num(s.registrationNo) })}
                  </dd>
                ) : null}
                {s.panNo ? (
                  <dd className="pl-6 text-muted-foreground">
                    {t("pan", { no: num(s.panNo) })}
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="flex items-center gap-2 font-semibold">
                  <MapPin
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {t("office")}
                </dt>
                <dd className="pl-6">{s.address[locale]}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 font-semibold">
                  <Phone
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {t("phone")}
                </dt>
                {s.phones.map((p) => (
                  <dd key={p} className="pl-6">
                    <a
                      href={telHref(p)}
                      className="inline-flex min-h-11 items-center hover:underline"
                      dir="ltr"
                    >
                      {num(formatPhoneDisplay(p))}
                    </a>
                  </dd>
                ))}
              </div>
              <div>
                <dt className="flex items-center gap-2 font-semibold">
                  <Mail
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {t("email")}
                </dt>
                <dd className="pl-6">
                  <a
                    href={`mailto:${s.email}`}
                    className="inline-flex min-h-11 items-center hover:underline"
                  >
                    {s.email}
                  </a>
                </dd>
              </div>
            </dl>
            <Link href="/contact" className={`${outlineBtn} mt-4 w-full`}>
              {t("contactCta")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
