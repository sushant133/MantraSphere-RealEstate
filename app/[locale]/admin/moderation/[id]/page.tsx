import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Gallery } from "@/components/property/Gallery";
import { KeyFacts } from "@/components/property/KeyFacts";
import { IntlScope } from "@/components/IntlScope";
import { PageHeader, Pill } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { toDetailDTO } from "@/lib/properties/dto";
import { formatPhoneDisplay } from "@/lib/phone";
import { displayPrice, placeLine } from "@/lib/properties/format";
import { District, Plan, Property, User } from "@/models";
import { Decision } from "../Decision";
import { WARNING_LABEL } from "@/lib/admin/labels";

export default async function ReviewPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/moderation/${id}`, "moderate");
  if (!mongoose.isValidObjectId(id)) notFound();
  await connectDB();
  const doc = await Property.findById(id).lean();
  if (!doc || !doc.locationNames?.district?.en) notFound();
  const [owner, plans, district] = await Promise.all([
    User.findById(doc.owner).select("name phone email verified role createdAt").lean(),
    Plan.find({ active: true }).sort({ sortWeight: 1 }).lean(),
    District.findById(doc.district).select("region").lean(),
  ]);
  const p = toDetailDTO(doc, { amenities: [], ownerVerified: !!owner?.verified });
  const price = displayPrice(p, "en");
  const dupCode = (doc.validationWarnings ?? []).find((w) => w.startsWith("POSSIBLE_DUPLICATE:"))?.split(":")[1];
  const dup = dupCode ? await Property.findOne({ code: dupCode }).select("_id").lean() : null;

  return (
    <IntlScope namespaces={["common", "property", "detail"]}>
      <div className="space-y-6">
        <PageHeader title={p.title.en || p.code} intro={`${p.code} · ${placeLine(p.locationNames, p.address, "en")}`} />
        {doc.status !== "PENDING_REVIEW" ? <Pill tone="info">Status: {doc.status}</Pill> : null}
        {(doc.validationWarnings ?? []).length ? (
          <div className="rounded-2xl bg-saffron/15 p-4 text-sm">
            <p className="font-semibold">Check before approving</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {doc.validationWarnings!.map((w) => {
                const [k, arg] = w.split(":");
                return (
                  <li key={w}>
                    {WARNING_LABEL[k] ?? k}
                    {k === "DESCRIPTION_CONFLICT" ? ` (${arg})` : null}
                    {k === "POSSIBLE_DUPLICATE" && dup ? (
                      <>
                        {" "}
                        — compare with{" "}
                        <Link href={`/admin/listings/${dup._id}`} className="font-mono underline">
                          {arg}
                        </Link>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Gallery images={p.images} title={p.title.en} />
            <p className="text-3xl font-bold text-price">{price ? `${price.main} ${price.suffix}` : "Price on request"}</p>
            <KeyFacts p={p} locale="en" region={district?.region === "TERAI" ? "TERAI" : "HILL"} />
            {p.description.en ? <p className="whitespace-pre-line">{p.description.en}</p> : null}
            {p.description.ne ? (
              <p lang="ne" className="whitespace-pre-line">
                {p.description.ne}
              </p>
            ) : null}
          </div>
          <aside className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
            <h2 className="font-semibold">Owner</h2>
            <p>{owner?.name ?? "—"} {owner?.verified ? <Pill tone="good">verified</Pill> : <Pill>not verified</Pill>}</p>
            <p dir="ltr">{owner?.phone ? formatPhoneDisplay(owner.phone) : "—"}</p>
            <p>{owner?.email ?? "—"}</p>
            <p>Listing contact: {doc.contactName} · <span dir="ltr">{doc.contactPhone ? formatPhoneDisplay(doc.contactPhone) : "—"}</span></p>
            {p.coordinates ? (
              <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${p.coordinates[1]}&mlon=${p.coordinates[0]}#map=17/${p.coordinates[1]}/${p.coordinates[0]}`}>
                Check pin on OpenStreetMap
              </a>
            ) : (
              <p className="text-destructive">No map pin</p>
            )}
          </aside>
        </div>
        {doc.status === "PENDING_REVIEW" ? (
          <Decision
            id={id}
            defaultPlan={doc.requestedPlan ? String(doc.requestedPlan) : null}
            plans={plans.map((pl) => ({ id: String(pl._id), label: `${pl.name?.en} — Rs ${pl.priceNpr.toLocaleString("en-IN")}${pl.durationDays ? ` / ${pl.durationDays} days` : " / until sold"}` }))}
          />
        ) : null}
      </div>
    </IntlScope>
  );
}
