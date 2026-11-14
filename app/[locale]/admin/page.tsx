import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DailyBars } from "@/components/admin/DailyBars";
import { PageHeader, Pill, STATUS_TONE } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { groupNepali } from "@/lib/price";
import { Lead, Payment, Property } from "@/models";

export default async function AdminDashboard({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin`);
  await connectDB();

  const now = new Date();
  const since = new Date(now.getTime() - 29 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [byStatus, daily, topDistricts, leads30, leadsNew, revenue] = await Promise.all([
    Property.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Property.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: since }, isDemo: { $ne: true } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kathmandu" } }, n: { $sum: 1 } } },
    ]),
    Property.aggregate<{ _id: string; n: number }>([
      { $match: { status: "ACTIVE" } },
      { $group: { _id: "$locationNames.district.en", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]),
    Lead.countDocuments({ createdAt: trusted({ $gte: since }) }),
    Lead.countDocuments({ status: "NEW" }),
    Payment.aggregate<{ _id: null; month: number; total: number }>([
      { $match: { status: "COMPLETED" } },
      { $group: { _id: null, total: { $sum: "$amountNpr" }, month: { $sum: { $cond: [{ $gte: ["$createdAt", monthStart] }, "$amountNpr", 0] } } } },
    ]),
  ]);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { day: d, count: daily.find((x) => x._id === d)?.n ?? 0 };
  });
  const count = (s: string) => byStatus.find((x) => x._id === s)?.n ?? 0;
  const statuses = ["PENDING_REVIEW", "ACTIVE", "DRAFT", "REJECTED", "SOLD", "RENTED", "EXPIRED"];
  const rev = revenue[0] ?? { month: 0, total: 0 };

  const tiles = [
    { label: "Awaiting review", value: count("PENDING_REVIEW"), href: "/admin/moderation" },
    { label: "Live listings", value: count("ACTIVE"), href: "/admin/listings?status=ACTIVE" },
    { label: "New leads", value: leadsNew, href: "/admin/leads?status=NEW" },
    { label: "Leads (30 days)", value: leads30, href: "/admin/leads" },
    { label: "Revenue this month", value: `Rs ${groupNepali(rev.month)}`, href: "/admin" },
    { label: "Revenue all time", value: `Rs ${groupNepali(rev.total)}`, href: "/admin" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" intro="Today’s work and how the marketplace is doing." />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="flex h-full flex-col rounded-2xl border bg-card p-4 hover:shadow-[var(--shadow-card-hover)]">
              <span className="text-2xl font-bold">{t.value}</span>
              <span className="mt-1 text-sm text-muted-foreground">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <DailyBars title="New listings per day (excluding demo data)" data={days} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="by-status" className="rounded-2xl border bg-card p-4">
          <h2 id="by-status" className="mb-3 font-semibold">Listings by status</h2>
          <ul className="space-y-2">
            {statuses.map((s) => (
              <li key={s} className="flex items-center justify-between">
                <Link href={`/admin/listings?status=${s}`} className="hover:underline">
                  <Pill tone={STATUS_TONE[s]}>{s.replace("_", " ").toLowerCase()}</Pill>
                </Link>
                <span className="font-semibold tabular-nums">{count(s)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="top-districts" className="rounded-2xl border bg-card p-4">
          <h2 id="top-districts" className="mb-3 font-semibold">Top districts (live listings)</h2>
          <ol className="space-y-2">
            {topDistricts.map((d, i) => (
              <li key={d._id ?? i} className="flex items-center justify-between">
                <span>
                  {i + 1}. {d._id ?? "—"}
                </span>
                <span className="font-semibold tabular-nums">{d.n}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
