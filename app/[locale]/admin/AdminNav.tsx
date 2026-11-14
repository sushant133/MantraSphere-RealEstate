"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; badge?: number };

export function AdminNav({ groups }: { groups: { title: string; items: NavItem[] }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
          <ul className="mt-1 space-y-0.5">
            {g.items.map((i) => {
              const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("tap flex items-center justify-between rounded-lg px-3 text-sm font-medium", active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    {i.label}
                    {i.badge ? (
                      <span className={cn("rounded-full px-2 text-xs font-bold", active ? "bg-white/20" : "bg-saffron text-saffron-foreground")}>{i.badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
