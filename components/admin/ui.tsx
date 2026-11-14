import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small presentational helpers shared by admin pages (server-safe). */

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">{title}</h1>
        {intro ? <p className="mt-1 text-sm text-muted-foreground">{intro}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const TONES = {
  neutral: "bg-muted text-foreground",
  good: "bg-success/15 text-success",
  warn: "bg-saffron/25 text-foreground",
  bad: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>{children}</span>;
}

export const STATUS_TONE: Record<string, keyof typeof TONES> = {
  ACTIVE: "good",
  PENDING_REVIEW: "warn",
  DRAFT: "neutral",
  REJECTED: "bad",
  SOLD: "info",
  RENTED: "info",
  EXPIRED: "neutral",
  DELETED: "bad",
};

export function Table({ head, children, caption }: { head: string[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" }).format(new Date(d)) : "—";
export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }).format(new Date(d)) : "—";
