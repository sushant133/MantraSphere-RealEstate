"use client";

import { BellRing, Home, Inbox, List, PlusCircle, Receipt, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "overview", href: "/dashboard", icon: Home },
  { key: "listings", href: "/dashboard/listings", icon: List },
  { key: "post", href: "/dashboard/post", icon: PlusCircle },
  { key: "leads", href: "/dashboard/leads", icon: Inbox },
  { key: "searches", href: "/dashboard/searches", icon: BellRing },
  { key: "payments", href: "/dashboard/payments", icon: Receipt },
  { key: "profile", href: "/dashboard/profile", icon: UserRound },
] as const;

/** Sidebar on desktop, horizontal scroller on mobile. */
export function DashNav({ labels, menuLabel }: { labels: Record<(typeof ITEMS)[number]["key"], string>; menuLabel: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={menuLabel} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map(({ key, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap flex items-center gap-2.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {labels[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
