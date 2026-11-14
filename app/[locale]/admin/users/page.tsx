import { setRequestLocale } from "next-intl/server";
import { Empty, PageHeader, Pill, Table, fmtDate } from "@/components/admin/ui";
import { inputCls, primaryBtn, selectCls } from "@/components/forms/styles";
import { requireStaff } from "@/lib/admin/auth";
import { ROLES, type Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { formatPhoneDisplay, normalizePhone } from "@/lib/phone";
import { escapeRegex } from "@/lib/sanitize";
import { Property, User } from "@/models";
import { UserRow } from "./UserRow";

export default async function UsersPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ q?: string; role?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff(locale, `/${locale}/admin/users`, "users");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const role = ROLES.includes(sp.role as never) ? sp.role : undefined;
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    const phone = normalizePhone(q);
    filter.$or = phone ? [{ phone: phone.e164 }] : [{ email: q.toLowerCase() }, { name: trusted({ $regex: escapeRegex(q), $options: "i" }) }];
  }
  await connectDB();
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(100).select("name email phone role disabled verified createdAt lastLoginAt").lean();
  const counts = new Map(
    (await Property.aggregate<{ _id: unknown; n: number }>([{ $match: { owner: { $in: users.map((u) => u._id) }, status: { $ne: "DELETED" } } }, { $group: { _id: "$owner", n: { $sum: 1 } } }])).map((c) => [String(c._id), c.n]),
  );

  return (
    <div>
      <PageHeader title="Users" intro="Change roles, disable accounts and grant the verified badge. Every change is logged." />
      <form method="get" role="search" aria-label="Search users" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="uq" className="text-sm font-semibold">
            Phone, email or name
          </label>
          <input id="uq" name="q" defaultValue={q} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ur" className="text-sm font-semibold">
            Role
          </label>
          <select id="ur" name="role" defaultValue={role ?? ""} className={selectCls}>
            <option value="">Any</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={primaryBtn}>
          Search
        </button>
      </form>
      {users.length === 0 ? (
        <Empty>No users match.</Empty>
      ) : (
        <Table caption="Users" head={["User", "Listings", "Joined / last login", "Role", "Verified", "Disabled", ""]}>
          {users.map((u) => (
            <UserRow
              key={String(u._id)}
              self={String(u._id) === me.id}
              user={{
                id: String(u._id),
                label: u.name || u.email || (u.phone ? formatPhoneDisplay(u.phone) : "—"),
                sub: [u.email, u.phone ? formatPhoneDisplay(u.phone) : null].filter(Boolean).join(" · "),
                listings: counts.get(String(u._id)) ?? 0,
                joined: `${fmtDate(u.createdAt as Date)} / ${fmtDate(u.lastLoginAt)}`,
                role: u.role,
                verified: !!u.verified,
                disabled: !!u.disabled,
              }}
            />
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        <Pill tone="info">Tip</Pill> Grant STAFF for moderators; ADMIN is for owners of the business only.
      </p>
    </div>
  );
}
