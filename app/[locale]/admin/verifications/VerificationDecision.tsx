"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { accentBtn, inputCls, outlineBtn } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { reviewVerification } from "../actions";

export function VerificationDecision({ userId }: { userId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await reviewVerification({ userId, approve, note });
      if (!r.ok) setErr(approve ? "Couldn’t approve." : "Add a reason (at least 5 characters) to reject.");
      else router.refresh();
    });
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor={`note-${userId}`} className="text-sm font-semibold">
          Reason if rejecting
        </label>
        <input id={`note-${userId}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </div>
      <button type="button" disabled={pending} onClick={() => decide(true)} className={accentBtn}>
        Approve
      </button>
      <button type="button" disabled={pending} onClick={() => decide(false)} className={cn(outlineBtn, "text-destructive")}>
        Reject
      </button>
      {err ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {err}
        </p>
      ) : null}
    </div>
  );
}
