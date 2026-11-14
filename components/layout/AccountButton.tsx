"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const KEY = "msr:session";

/**
 * "Log in" / "Dashboard" without making public pages dynamic: the session
 * is read from /api/auth/session in the browser (cached for the tab).
 */
export function AccountButton({ labels, className }: { labels: { login: string; dashboard: string }; className?: string }) {
  const [name, setName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(KEY);
      if (cached !== null) setName(cached || null);
    } catch {
      /* storage blocked */
    }
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((s: { user?: { name?: string | null; email?: string | null } } | null) => {
        const n = s?.user ? (s.user.name || s.user.email || labels.dashboard) : null;
        setName(n);
        try {
          sessionStorage.setItem(KEY, n ?? "");
        } catch {
          /* ignore */
        }
      })
      .catch(() => setName(null));
  }, [labels.dashboard]);

  const cls = cn("tap inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted", className);
  if (name)
    return (
      <Link href="/dashboard" className={cls}>
        <LayoutDashboard className="size-4" aria-hidden="true" />
        {labels.dashboard}
      </Link>
    );
  return (
    <Link href="/login" className={cls}>
      {labels.login}
    </Link>
  );
}
