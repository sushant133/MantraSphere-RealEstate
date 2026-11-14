"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { inputCls, outlineBtn } from "@/components/forms/styles";
import { cn } from "@/lib/utils";
import { verifyBankPayment } from "../actions";

/** Confirm or reject a bank transfer after checking the slip against the bank statement. */
export function BankDecision({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (approve: boolean) =>
    start(async () => {
      if (approve && !window.confirm("Confirm the money has reached the account?")) return;
      const r = await verifyBankPayment({ id, approve, note });
      if (!r.ok) setErr(approve ? "Couldn’t confirm." : "Give a reason (5+ characters) to reject.");
      else router.refresh();
    });
  return (
    <div className="mt-2 space-y-2">
      <label htmlFor={`bn-${id}`} className="sr-only">
        Reason if rejecting
      </label>
      <input id={`bn-${id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason if rejecting" className={cn(inputCls, "h-11 w-48 text-sm")} />
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => go(true)} className={cn(outlineBtn, "h-11 px-3 text-sm text-success")}>
          Confirm received
        </button>
        <button type="button" disabled={pending} onClick={() => go(false)} className={cn(outlineBtn, "h-11 px-3 text-sm text-destructive")}>
          Reject
        </button>
      </div>
      {err ? <p role="alert" className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
