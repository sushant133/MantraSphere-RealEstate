import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { can, type Permission } from "@/lib/admin/auth";
import { getSessionUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { AgentProfile, Payment, Property, Report } from "@/models";
import { AdminNav, type NavItem } from "./AdminNav";

export const metadata: Metadata = { title: { absolute: "Admin | MantraSphere" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const user = await getSessionUser();
  if (!user) return children; // each page redirects to login with its own path
  if (user.role !== "ADMIN" && user.role !== "STAFF") notFound();

  await connectDB();
  const [pending, reports, verifications, bank] = await Promise.all([
    Property.countDocuments({ status: "PENDING_REVIEW" }),
    Report.countDocuments({ status: "OPEN" }),
    AgentProfile.countDocuments({ verificationStatus: "PENDING" }),
    Payment.countDocuments({ status: "PENDING_VERIFICATION" }),
  ]);
  const item = (href: string, label: string, perm: Permission, badge?: number): NavItem[] => (can(user.role, perm) ? [{ href, label, badge }] : []);
  const groups = [
    { title: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
    {
      title: "Operations",
      items: [
        ...item("/admin/moderation", "Moderation queue", "moderate", pending),
        ...item("/admin/reports", "Reports", "moderate", reports),
        ...item("/admin/payments", "Payments", "moderate", bank),
        ...item("/admin/listings", "Listings", "listings"),
        ...item("/admin/leads", "Leads", "leads"),
        ...item("/admin/verifications", "Verifications", "verify", verifications),
        ...item("/admin/users", "Users", "users"),
        ...item("/admin/import", "Bulk import", "import"),
      ],
    },
    {
      title: "Content",
      items: [
        ...item("/admin/content/blog", "Blog posts", "content"),
        ...item("/admin/content/faqs", "FAQ", "content"),
        ...item("/admin/content/testimonials", "Testimonials", "content"),
        ...item("/admin/content/banners", "Banners", "content"),
        ...item("/admin/content/amenities", "Amenities", "content"),
        ...item("/admin/content/districts", "Districts", "content"),
        ...item("/admin/content/municipalities", "Local levels", "content"),
      ],
    },
    {
      title: "Setup",
      items: [...item("/admin/content/plans", "Plans", "plans"), ...item("/admin/settings", "Site settings", "settings"), ...item("/admin/audit", "Audit log", "audit")],
    },
  ].filter((g) => g.items.length);

  return (
    <div className="container-page py-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-8">
      <aside className="mb-6 lg:col-span-3 lg:mb-0 xl:col-span-2">
        <div className="lg:sticky lg:top-24">
          <AdminNav groups={groups} />
        </div>
      </aside>
      <div className="min-w-0 lg:col-span-9 xl:col-span-10">{children}</div>
    </div>
  );
}
