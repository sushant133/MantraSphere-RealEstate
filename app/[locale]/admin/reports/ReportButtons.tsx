"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { outlineBtn } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { resolveReport } from "../actions";

export function ReportButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (status: "RESOLVED" | "DISMISSED") =>
    start(async () => {
      await resolveReport({ id, status });
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <button type="button" disabled={pending} onClick={() => act("RESOLVED")} className={cn(outlineBtn, "h-11 px-3 text-sm")}>
        Resolved
      </button>
      <button type="button" disabled={pending} onClick={() => act("DISMISSED")} className={cn(outlineBtn, "h-11 px-3 text-sm")}>
        Dismiss
      </button>
    </div>
  );
}
