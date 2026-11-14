"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { accentBtn, labelCls, outlineBtn, selectCls, textareaCls } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { approveListing, rejectListing } from "../actions";

const QUICK = [
  "Photos are missing or unclear — please add clear photos of the property.",
  "The description contradicts the details (road width, rooms or area). Please correct it.",
  "The price looks wrong. Please check the amount and the price unit.",
  "This looks like a duplicate of an existing listing.",
  "The map pin is not at the property location.",
];

export function Decision({ id, plans, defaultPlan }: { id: string; plans: { id: string; label: string }[]; defaultPlan: string | null }) {
  const router = useRouter();
  const [plan, setPlan] = useState(defaultPlan ?? plans[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error === "not_pending" ? "This listing is no longer waiting for review." : "Couldn’t save. Check the fields and try again.");
      else router.push("/admin/moderation");
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="approve-title" className="rounded-2xl border bg-card p-5">
        <h2 id="approve-title" className="font-semibold">Approve</h2>
        <p className="mt-1 text-sm text-muted-foreground">Goes live immediately on the selected plan (tier, home-page section and expiry follow the plan). The owner’s paid plan is pre-selected; choosing another plan is complimentary.</p>
        <label htmlFor="plan" className={cn(labelCls, "mt-4 block")}>
          Plan
        </label>
        <select id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={cn(selectCls, "mt-1")}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.id === defaultPlan ? " (requested)" : ""}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending || !plan} onClick={() => run(() => approveListing({ id, planId: plan }))} className={cn(accentBtn, "mt-4")}>
          Approve and publish
        </button>
      </section>
      <section aria-labelledby="reject-title" className="rounded-2xl border bg-card p-5">
        <h2 id="reject-title" className="font-semibold">Send back for changes</h2>
        <p className="mt-1 text-sm text-muted-foreground">The owner sees this reason and gets an SMS/email.</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setReason(q)} className="tap rounded-full border px-3 text-left text-xs hover:bg-muted">
              {q.split(" — ")[0].split(".")[0]}
            </button>
          ))}
        </div>
        <label htmlFor="reason" className={cn(labelCls, "mt-3 block")}>
          Reason
        </label>
        <textarea id="reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={cn(textareaCls, "mt-1")} />
        <button type="button" disabled={pending || reason.trim().length < 5} onClick={() => run(() => rejectListing({ id, reason }))} className={cn(outlineBtn, "mt-3 text-destructive")}>
          Send back
        </button>
      </section>
      {error ? (
        <p role="alert" className="text-sm text-destructive lg:col-span-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
