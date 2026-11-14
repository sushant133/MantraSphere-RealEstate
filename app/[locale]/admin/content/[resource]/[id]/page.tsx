import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { MODELS, toForm } from "@/lib/admin/registry";
import { getResource } from "@/lib/admin/resources";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { ResourceForm } from "./ResourceForm";

export default async function ResourceEdit({ params }: { params: Promise<{ locale: Locale; resource: string; id: string }> }) {
  const { locale, resource, id } = await params;
  setRequestLocale(locale);
  const def = getResource(resource);
  if (!def) notFound();
  await requireStaff(locale, `/${locale}/admin/content/${resource}/${id}`, def.perm);
  const isNew = id === "new";
  if (isNew && !def.create) notFound();
  if (!isNew && !mongoose.isValidObjectId(id)) notFound();
  await connectDB();
  const doc = isNew ? null : ((await MODELS[resource]().findById(id).lean()) as Record<string, unknown> | null);
  if (!isNew && !doc) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader title={isNew ? `New ${def.singular}` : `Edit ${def.singular}`} />
      <ResourceForm resource={resource} id={isNew ? null : id} initial={toForm(def, doc)} />
    </div>
  );
}
