import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/phone";
import { DEFAULT_SETTINGS } from "@/lib/site-defaults";
import { SiteSetting } from "@/models";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/settings`, "settings");
  await connectDB();
  const s = ((await SiteSetting.findById("site").lean()) ?? {}) as Record<string, never>;
  const d = DEFAULT_SETTINGS;
  const pair = (v: { en?: string; ne?: string } | undefined, fb: { en: string; ne: string }) => ({ en: v?.en ?? fb.en, ne: v?.ne ?? fb.ne });
  const social = (s.social ?? {}) as Record<string, string | undefined>;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Site settings" intro="One place for the details shown across the whole site." />
      <SettingsForm
        initial={{
          companyName: pair(s.companyName, d.companyName),
          legalName: s.legalName ?? d.legalName,
          registrationNo: s.registrationNo ?? "",
          panNo: s.panNo ?? "",
          address: pair(s.address, d.address),
          geo: { lat: (s.geo as { lat?: number })?.lat ?? d.geo.lat, lng: (s.geo as { lng?: number })?.lng ?? d.geo.lng },
          phones: ((s.phones as string[] | undefined)?.length ? (s.phones as string[]) : d.phones).map(formatPhoneDisplay),
          whatsapp: s.whatsapp ?? d.whatsapp,
          viber: s.viber ?? d.viber,
          email: s.email ?? d.email,
          officeHours: pair(s.officeHours, d.officeHours),
          social: { facebook: social.facebook ?? "", instagram: social.instagram ?? "", youtube: social.youtube ?? "", tiktok: social.tiktok ?? "", linkedin: social.linkedin ?? "" },
          about: pair(s.about, { en: "", ne: "" }),
          bankAccounts: ((s.bankAccounts as { bank?: string; accountName?: string; accountNumber?: string; branch?: string }[] | undefined) ?? []).map((b) => ({
            bank: b.bank ?? "",
            accountName: b.accountName ?? "",
            accountNumber: b.accountNumber ?? "",
            branch: b.branch ?? "",
          })),
          loanRates: ((s.loanRates as { bank?: string; ratePct?: number }[] | undefined) ?? []).map((r) => ({ bank: r.bank ?? "", ratePct: r.ratePct ?? 0 })),
        }}
      />
    </div>
  );
}
