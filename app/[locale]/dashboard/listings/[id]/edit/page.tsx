import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Wizard } from "@/components/wizard/Wizard";
import { STEPS } from "@/components/wizard/steps";
import { requireUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { docToDraft, EDITABLE_STATUSES, loadOwned } from "@/lib/properties/owner";
import { getLocationIndex } from "@/lib/properties/queries";
import { Amenity, Plan } from "@/models";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/listings/${id}/edit`);
  const doc = await loadOwned(id, user.id);
  if (!doc) notFound();
  const t = await getTranslations({ locale, namespace: "wizard" });

  if (!(EDITABLE_STATUSES as readonly string[]).includes(doc.status)) {
    return (
      <div className="rounded-2xl border p-6">
        <p>{t("notEditable")}</p>
        <Link href="/dashboard/listings" className="tap mt-3 inline-flex items-center font-semibold text-primary underline-offset-4 hover:underline">
          {t("back")}
        </Link>
      </div>
    );
  }

  await connectDB();
  const [locations, amenities, plans] = await Promise.all([
    getLocationIndex(),
    Amenity.find().sort({ order: 1 }).lean(),
    Plan.find({ active: true }).sort({ sortWeight: 1 }).lean(),
  ]);
  const draft = docToDraft(doc.toObject());
  const { imagesFull, ...initial } = draft;
  const planSlug = doc.requestedPlan ? plans.find((p) => String(p._id) === String(doc.requestedPlan))?.slug ?? null : null;
  const stepParam = Number((await searchParams).step);
  const initialStep = Number.isInteger(stepParam) && stepParam >= 1 && stepParam <= STEPS.length ? stepParam - 1 : 0;

  return (
    <Wizard
      id={String(doc._id)}
      code={doc.code}
      locale={locale}
      initial={initial}
      initialImages={imagesFull}
      initialPlanSlug={planSlug}
      initialStep={initialStep}
      staff={user.role === "ADMIN" || user.role === "STAFF"}
      districts={locations.districts.map((d) => ({ id: d.id, en: d.en, ne: d.ne, region: d.region, center: d.center }))}
      amenities={amenities.map((a) => ({ slug: a.slug, en: a.name?.en ?? a.slug, ne: a.name?.ne || a.name?.en || a.slug, appliesTo: a.appliesTo ?? [] }))}
      plans={plans.map((p) => ({
        slug: p.slug,
        name: { en: p.name?.en ?? p.slug, ne: p.name?.ne ?? p.slug },
        priceNpr: p.priceNpr,
        durationDays: p.durationDays ?? null,
        maxPhotos: p.maxPhotos ?? 10,
        facebookPromotionDays: p.facebookPromotionDays ?? 0,
        features: { en: p.features?.en ?? [], ne: p.features?.ne ?? [] },
      }))}
    />
  );
}
