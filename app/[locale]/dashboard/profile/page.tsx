import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/phone";
import { AgentProfile, User } from "@/models";
import { ProfileForm, VerificationUpload } from "./ProfileForms";

export default async function ProfilePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/dashboard/profile`);
  await connectDB();
  const [user, profile, t] = await Promise.all([
    User.findById(session.id).select("name email phone locale").lean(),
    AgentProfile.findOne({ user: session.id }).lean(),
    getTranslations({ locale, namespace: "dashboard" }),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{t("profileTitle")}</h1>
      <dl className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{t("phone")}</dt>
          <dd className="font-medium" dir="ltr">{user?.phone ? formatPhoneDisplay(user.phone) : t("notSet")}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("email")}</dt>
          <dd className="font-medium">{user?.email ?? t("notSet")}</dd>
        </div>
      </dl>
      <section aria-labelledby="profile-details" className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 id="profile-details" className="sr-only">
          {t("profileTitle")}
        </h2>
        <ProfileForm
          initial={{
            name: user?.name ?? "",
            locale: user?.locale === "ne" ? "ne" : "en",
            kind: (profile?.kind as "INDIVIDUAL_OWNER" | "AGENT" | "AGENCY") ?? "INDIVIDUAL_OWNER",
            agencyName: profile?.agencyName ?? "",
            whatsapp: profile?.whatsapp ?? "",
            viber: profile?.viber ?? "",
          }}
        />
      </section>
      <section aria-labelledby="verification" className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 id="verification" className="text-xl font-semibold text-primary">
          {t("verificationTitle")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("verificationIntro")}</p>
        <VerificationUpload
          status={(profile?.verificationStatus as "NONE" | "PENDING" | "APPROVED" | "REJECTED") ?? "NONE"}
          note={profile?.verificationNote ?? ""}
          count={profile?.documents?.length ?? 0}
        />
      </section>
    </div>
  );
}
