import { setRequestLocale } from "next-intl/server";
import { Empty, PageHeader, Table, fmtDateTime } from "@/components/admin/ui";
import { inputCls, primaryBtn } from "@/components/forms/styles";
import { requireStaff } from "@/lib/admin/auth";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { AuditLog, User } from "@/models";

const short = (v: unknown) => {
  const s = JSON.stringify(v ?? {});
  return s.length > 220 ? `${s.slice(0, 220)}…` : s;
};

export default async function AuditPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ action?: string; entityId?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, `/${locale}/admin/audit`, "audit");
  const sp = await searchParams;
  const filter: Record<string, unknown> = {};
  if (sp.action && /^[a-z_.]{3,60}$/.test(sp.action)) filter.action = sp.action;
  if (sp.entityId && /^[\w:./-]{1,100}$/.test(sp.entityId)) filter.entityId = sp.entityId;
  await connectDB();
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(300).lean();
  const actors = new Map((await User.find({ _id: trusted({ $in: logs.map((l) => l.actor) }) }).select("name email phone").lean()).map((u) => [String(u._id), u]));

  return (
    <div>
      <PageHeader title="Audit log" intro="Every admin action, newest first (latest 300)." />
      <form method="get" role="search" aria-label="Filter audit log" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="aa" className="text-sm font-semibold">Action</label>
          <input id="aa" name="action" defaultValue={sp.action ?? ""} placeholder="property.approve" className={inputCls} />
        </div>
        <div>
          <label htmlFor="ae" className="text-sm font-semibold">Entity id</label>
          <input id="ae" name="entityId" defaultValue={sp.entityId ?? ""} className={inputCls} />
        </div>
        <button type="submit" className={primaryBtn}>
          Filter
        </button>
      </form>
      {logs.length === 0 ? (
        <Empty>No entries.</Empty>
      ) : (
        <Table caption="Audit log" head={["When", "Who", "Action", "Entity", "Before", "After"]}>
          {logs.map((l) => {
            const a = actors.get(String(l.actor));
            return (
              <tr key={String(l._id)} className="align-top">
                <td className="px-4 py-2 whitespace-nowrap">{fmtDateTime(l.createdAt as Date)}</td>
                <td className="px-4 py-2">{a?.name || a?.email || a?.phone || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {l.entity}/{l.entityId}
                </td>
                <td className="max-w-xs px-4 py-2 font-mono text-xs break-all text-muted-foreground">{short(l.before)}</td>
                <td className="max-w-xs px-4 py-2 font-mono text-xs break-all">{short(l.after)}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
