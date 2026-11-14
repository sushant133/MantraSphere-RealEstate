import { setRequestLocale } from "next-intl/server";
import { Empty, PageHeader, fmtDateTime } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/phone";
import { AgentProfile, User } from "@/models";
import { VerificationDecision } from "./VerificationDecision";

const KIND: Record<string, string> = { INDIVIDUAL_OWNER: "Owner", AGENT: "Agent", AGENCY: "Agency" };
const DOC: Record<string, string> = { CITIZENSHIP: "Citizenship", AGENCY_REGISTRATION: "Agency registration", PAN: "PAN", OTHER: "Other" };

export default async function VerificationsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/verifications`, "verify");
  await connectDB();
  const profiles = await AgentProfile.find({ verificationStatus: "PENDING" }).sort({ updatedAt: 1 }).limit(100).lean();
  const users = new Map((await User.find({ _id: trusted({ $in: profiles.map((p) => p.user) }) }).select("name phone email").lean()).map((u) => [String(u._id), u]));

  return (
    <div>
      <PageHeader title="Verifications" intro="Check documents against the account details. Approving grants the verified badge (and the agent role for agents/agencies)." />
      {profiles.length === 0 ? (
        <Empty>No documents waiting for review.</Empty>
      ) : (
        <ul className="space-y-4">
          {profiles.map((p) => {
            const u = users.get(String(p.user));
            return (
              <li key={String(p._id)} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">
                    {u?.name || "—"} · {KIND[p.kind] ?? p.kind}
                    {p.agencyName ? ` · ${p.agencyName}` : ""}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {u?.phone ? formatPhoneDisplay(u.phone) : ""} {u?.email ?? ""}
                  </span>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {(p.documents ?? []).map((d, i) => (
                    <li key={i}>
                      <a
                        href={`/api/admin/files?key=${encodeURIComponent(d.url ?? "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tap inline-flex items-center rounded-xl border px-3 text-sm hover:bg-muted"
                      >
                        {DOC[d.kind ?? ""] ?? d.kind} · {fmtDateTime(d.uploadedAt)}
                      </a>
                    </li>
                  ))}
                </ul>
                <VerificationDecision userId={String(p.user)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
