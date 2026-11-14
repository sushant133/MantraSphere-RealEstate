import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader, Pill, STATUS_TONE, Table, fmtDateTime } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { AuditLog, Property, User } from "@/models";
import { ListingEditor } from "./ListingEditor";

export default async function AdminListingPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/listings/${id}`, "listings");
  if (!mongoose.isValidObjectId(id)) notFound();
  await connectDB();
  const p = await Property.findById(id).lean();
  if (!p) notFound();
  const [owner, history] = await Promise.all([
    User.findById(p.owner).select("name phone email").lean(),
    AuditLog.find({ entity: "property", entityId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const actors = new Map((await User.find({ _id: trusted({ $in: history.map((h) => h.actor) }) }).select("name email phone").lean()).map((u) => [String(u._id), u]));
  const isPublic = ["ACTIVE", "SOLD", "RENTED"].includes(p.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.title?.en || p.code}
        intro={`${p.code} · owner: ${owner?.name || owner?.phone || owner?.email || "—"}`}
        actions={
          <>
            <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
            {isPublic ? (
              <Link href={`/property/${p.slug}`} className="tap inline-flex items-center rounded-xl border px-4 text-sm font-semibold">
                View public page
              </Link>
            ) : null}
            {p.status === "PENDING_REVIEW" ? (
              <Link href={`/admin/moderation/${id}`} className="tap inline-flex items-center rounded-xl border px-4 text-sm font-semibold">
                Review
              </Link>
            ) : null}
          </>
        }
      />
      <ListingEditor
        initial={{
          id,
          titleEn: p.title?.en ?? "",
          titleNe: p.title?.ne ?? "",
          titleLocked: !!p.titleLocked,
          status: p.status,
          tier: p.tier ?? "NORMAL",
          expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : null,
          priceNpr: p.priceNpr ?? null,
          priceOnRequest: !!p.priceOnRequest,
          negotiable: !!p.negotiable,
          priceNeedsApproval: !!p.priceNeedsApproval,
          descriptionEn: p.description?.en ?? "",
          descriptionNe: p.description?.ne ?? "",
          contactName: p.contactName ?? "",
          contactPhone: p.contactPhone ?? "",
        }}
      />
      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-3 font-semibold">History</h2>
        <Table caption="Admin actions on this listing" head={["When", "Who", "Action", "Changed"]}>
          {history.map((h) => {
            const a = actors.get(String(h.actor));
            return (
              <tr key={String(h._id)} className="align-top">
                <td className="px-4 py-2 whitespace-nowrap">{fmtDateTime(h.createdAt as Date)}</td>
                <td className="px-4 py-2">{a?.name || a?.email || a?.phone || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{h.action}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{Object.keys((h.after as object) ?? {}).join(", ") || "—"}</td>
              </tr>
            );
          })}
        </Table>
      </section>
    </div>
  );
}
