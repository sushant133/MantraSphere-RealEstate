"use client";

import { useState, useTransition } from "react";
import { outlineBtn, selectCls } from "@/components/forms/styles";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { updateUser } from "../actions";

type U = { id: string; label: string; sub: string; listings: number; joined: string; role: string; verified: boolean; disabled: boolean };

export function UserRow({ user, self }: { user: U; self: boolean }) {
  const [v, setV] = useState(user);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = v.role !== user.role || v.verified !== user.verified || v.disabled !== user.disabled;

  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <div className="font-semibold">{user.label}</div>
        <div className="text-xs text-muted-foreground">{user.sub}</div>
      </td>
      <td className="px-4 py-3 tabular-nums">{user.listings}</td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">{user.joined}</td>
      <td className="px-4 py-3">
        <label htmlFor={`role-${user.id}`} className="sr-only">
          Role for {user.label}
        </label>
        <select id={`role-${user.id}`} value={v.role} disabled={self} onChange={(e) => setV({ ...v, role: e.target.value })} className={cn(selectCls, "w-32")}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input type="checkbox" aria-label={`Verified badge for ${user.label}`} checked={v.verified} onChange={(e) => setV({ ...v, verified: e.target.checked })} className="size-5 accent-[var(--primary)]" />
      </td>
      <td className="px-4 py-3">
        <input type="checkbox" aria-label={`Disable ${user.label}`} disabled={self} checked={v.disabled} onChange={(e) => setV({ ...v, disabled: e.target.checked })} className="size-5 accent-[var(--destructive)]" />
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await updateUser({ id: user.id, role: v.role, verified: v.verified, disabled: v.disabled });
              setMsg(r.ok ? "Saved" : r.error === "self_lockout" ? "You can’t demote or disable yourself" : "Failed");
            })
          }
          className={cn(outlineBtn, "h-11 px-3 text-sm")}
        >
          Save
        </button>
        <span aria-live="polite" className="ml-2 text-xs">
          {msg}
        </span>
      </td>
    </tr>
  );
}
