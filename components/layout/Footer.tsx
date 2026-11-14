import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/constants";
import { formatPhoneDisplay, telHref, whatsappHref } from "@/lib/phone";
import { toDevanagariDigits } from "@/lib/price";
import type { SiteSettings } from "@/lib/site";
import { Logo } from "./Logo";

const SOCIAL_LABELS = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", linkedin: "LinkedIn" } as const;

/** Full-width footer: brand, link columns, contact block and legal bar. */
export async function Footer({ locale, settings }: { locale: Locale; settings: SiteSettings }) {
  const t = await getTranslations({ locale });
  const year = new Date().getFullYear();
  const num = (s: string) => (locale === "ne" ? toDevanagariDigits(s) : s);
  const [primary, ...rest] = locale === "ne" ? ["मन्त्रास्फियर", "रियल इस्टेट"] : ["MantraSphere", "Real Estate"];
  const social = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter((k) => settings.social[k]);

  const columns = [
    {
      title: t("footer.explore"),
      links: [
        { label: t("nav.buy"), href: "/properties?purpose=sale" },
        { label: t("nav.rent"), href: "/properties?purpose=rent" },
        { label: t("nav.land"), href: "/properties?type=land" },
        { label: t("nav.commercial"), href: "/properties?type=commercial" },
        { label: t("footer.recentlySold"), href: "/properties?status=sold" },
      ],
    },
    {
      title: t("footer.tools"),
      links: [
        { label: t("footer.emiCalculator"), href: "/tools/emi-calculator" },
        { label: t("footer.landConverter"), href: "/tools/land-unit-converter" },
        { label: t("footer.compare"), href: "/compare" },
        { label: t("nav.saved"), href: "/saved" },
        { label: t("nav.blog"), href: "/blog" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("nav.about"), href: "/about" },
        { label: t("nav.pricing"), href: "/pricing" },
        { label: t("footer.faq"), href: "/faq" },
        { label: t("nav.contact"), href: "/contact" },
      ],
    },
  ];

  return (
    <footer className="mt-16 bg-navy-900 pb-24 text-white/80 md:pb-0">
      <div className="container-wide grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
        <div className="sm:col-span-2 lg:col-span-4">
          <span className="inline-flex rounded-xl bg-white p-2 pr-3">
            <Logo name={{ primary, secondary: rest.join(" ") }} latin={locale === "en"} />
          </span>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">{t("footer.tagline")}</p>
          {social.length ? (
            <div className="mt-5">
              <h2 className="text-sm font-semibold text-white">{t("footer.follow")}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {social.map((k) => (
                  <li key={k}>
                    <a href={settings.social[k]} target="_blank" rel="noopener" className="tap inline-flex items-center rounded-full border border-white/20 px-4 text-sm hover:bg-white/10 hover:text-white">
                      {SOCIAL_LABELS[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {columns.map((c) => (
          <FooterLinks key={c.title} title={c.title} links={c.links} className="lg:col-span-2" />
        ))}

        <div className="sm:col-span-2 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{t("footer.contactUs")}</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-saffron" aria-hidden="true" />
              <span>{settings.address[locale]}</span>
            </li>
            {settings.phones.map((p) => (
              <li key={p}>
                <a href={telHref(p)} className="tap -my-2 inline-flex items-center gap-3 hover:text-white">
                  <Phone className="size-4 shrink-0 text-saffron" aria-hidden="true" />
                  <span dir="ltr">{num(formatPhoneDisplay(p))}</span>
                </a>
              </li>
            ))}
            {settings.whatsapp ? (
              <li>
                <a href={whatsappHref(settings.whatsapp, "")} target="_blank" rel="noopener" className="tap -my-2 inline-flex items-center gap-3 hover:text-white">
                  <MessageCircle className="size-4 shrink-0 text-saffron" aria-hidden="true" />
                  WhatsApp
                </a>
              </li>
            ) : null}
            <li>
              <a href={`mailto:${settings.email}`} className="tap -my-2 inline-flex items-center gap-3 break-all hover:text-white">
                <Mail className="size-4 shrink-0 text-saffron" aria-hidden="true" />
                <span>{settings.email}</span>
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-saffron" aria-hidden="true" />
              <span>
                <span className="sr-only">{t("footer.officeHours")}: </span>
                {settings.officeHours[locale]}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-wide flex flex-col gap-3 py-5 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            {t("footer.rights", { year: num(String(year)), company: settings.companyName[locale] })}
            <span className="hidden sm:inline"> · {settings.legalName}</span>
          </p>
          <ul className="flex flex-wrap gap-x-5">
            <li>
              <Link href="/privacy" className="tap inline-flex items-center hover:text-white">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="tap inline-flex items-center hover:text-white">
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <a href="/sitemap.xml" className="tap inline-flex items-center hover:text-white">
                {t("footer.sitemap")}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links, className }: { title: string; links: { label: string; href: string }[]; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{title}</h2>
      <ul className="mt-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="tap inline-flex items-center text-sm hover:text-white hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
