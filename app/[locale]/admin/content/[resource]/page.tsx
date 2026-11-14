import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Empty, PageHeader, Pill, Table, fmtDate } from "@/components/admin/ui";
import { inputCls, accentBtn, primaryBtn } from "@/components/forms/styles";
import { requireStaff } from "@/lib/admin/auth";
import { cell, MODELS } from "@/lib/admin/registry";
import { getResource, type Column } from "@/lib/admin/resources";
import type { Locale } from "@/lib/constants";
import { connectDB, trusted } from "@/lib/db";
import { groupNepali } from "@/lib/price";
import { escapeRegex } from "@/lib/sanitize";

function render(col: Column, v: unknown) {
  switch (col.format) {
    case "i18n":
      return (v as { en?: string })?.en || "—";
    case "bool":
      return v ? <Pill tone="good">yes</Pill> : <Pill>no</Pill>;
    case "npr":
      return typeof v === "number" ? `Rs ${groupNepali(v)}` : "—";
    case "date":
      return v ? fmtDate(v as Date) : "—";
    case "list":
      return (v as string[])?.length ? (v as string[]).join(", ") : "All";
    default:
      return v == null || v === "" ? "—" : String(v);
  }
}

export default async function ResourceList({ params, searchParams }: { params: Promise<{ locale: Locale; resource: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale, resource } = await params;
  setRequestLocale(locale);
  const def = getResource(resource);
  if (!def) notFound();
  await requireStaff(locale, `/${locale}/admin/content/${resource}`, def.perm);
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  await connectDB();
  const filter = q ? { $or: def.search.map((k) => ({ [k]: trusted({ $regex: escapeRegex(q), $options: "i" }) })) } : {};
  const docs = (await MODELS[resource]().find(filter as never).sort(def.sort).limit(300).lean()) as unknown as Record<string, unknown>[];

  return (
    <div>
      <PageHeader
        title={def.label}
        intro={`${docs.length}${docs.length === 300 ? "+" : ""} ${def.label.toLowerCase()}`}
        actions={
          def.create ? (
            <Link href={`/admin/content/${resource}/new`} className={accentBtn}>
              New {def.singular}
            </Link>
          ) : null
        }
      />
      <form method="get" role="search" aria-label={`Search ${def.label}`} className="mb-5 flex gap-3">
        <label htmlFor="cq" className="sr-only">
          Search
        </label>
        <input id="cq" name="q" defaultValue={q} placeholder="Search…" className={inputCls} />
        <button type="submit" className={primaryBtn}>
          Search
        </button>
      </form>
      {docs.length === 0 ? (
        <Empty>Nothing here yet.</Empty>
      ) : (
        <Table caption={def.label} head={[...def.columns.map((c) => c.label), ""]}>
          {docs.map((d) => (
            <tr key={String(d._id)}>
              {def.columns.map((c, i) => (
                <td key={c.key} className="px-4 py-3">
                  {i === 0 ? (
                    <Link href={`/admin/content/${resource}/${d._id}`} className="font-semibold text-primary hover:underline">
                      {render(c, cell(d, c.key))}
                    </Link>
                  ) : (
                    render(c, cell(d, c.key))
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <Link href={`/admin/content/${resource}/${d._id}`} className="tap inline-flex items-center rounded-lg px-3 text-sm font-semibold text-primary hover:underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
