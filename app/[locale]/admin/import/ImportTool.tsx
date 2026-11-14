"use client";

import { useState } from "react";
import { accentBtn, outlineBtn } from "@/components/forms/styles";
import { cn } from "@/lib/utils";

type Row = { row: number; errors: string[]; issues: string[]; publish: boolean; draft: unknown };
type Report = { total: number; valid: number; rows: Row[]; created: { row: number; code: string; status: string }[]; truncated: boolean };

/** Upload → dry-run report (errors per row) → import. */
export function ImportTool() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (mode: "dry" | "commit") => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    const res = await fetch("/api/admin/import", { method: "POST", body: fd }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res?.ok || !data) return setError(data?.error ?? "Upload failed.");
    setReport(data as Report);
  };

  const bad = report?.rows.filter((r) => r.errors.length) ?? [];
  const incomplete = report?.rows.filter((r) => !r.errors.length && r.issues.length) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5">
        <div>
          <label htmlFor="imp-file" className="text-sm font-semibold">
            CSV or Excel (.xlsx) file, up to 500 rows
          </label>
          <input
            id="imp-file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
            }}
            className="mt-1 block text-sm"
          />
        </div>
        <button type="button" disabled={!file || busy} onClick={() => send("dry")} className={outlineBtn}>
          Check file
        </button>
        <a href="/api/admin/import" download className="tap inline-flex items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Download template
        </a>
      </div>
      <div aria-live="polite">
        {busy ? <p className="text-sm">Working…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      {report ? (
        <div className="space-y-4">
          {report.created.length ? (
            <div role="status" className="rounded-2xl bg-success/10 p-4 text-sm">
              <p className="font-semibold text-success">Imported {report.created.length} listings.</p>
              <ul className="mt-2 space-y-0.5">
                {report.created.map((c) => (
                  <li key={c.code}>
                    Row {c.row}: <span className="font-mono">{c.code}</span> — {c.status === "ACTIVE" ? "live" : c.status === "DRAFT" ? "saved as draft (incomplete or publish = no)" : "awaiting review"}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">
              {report.total} rows read{report.truncated ? " (only the first 500 are processed)" : ""}: <strong>{report.valid}</strong> can be imported, <strong>{bad.length}</strong> have errors.
            </p>
          )}
          {bad.length ? (
            <div className="rounded-2xl border border-destructive/40 p-4">
              <p className="font-semibold text-destructive">Rows with errors (not imported)</p>
              <ul className="mt-2 space-y-1 text-sm">
                {bad.map((r) => (
                  <li key={r.row}>
                    <strong>Row {r.row}:</strong> {r.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {incomplete.length && !report.created.length ? (
            <div className="rounded-2xl bg-saffron/15 p-4 text-sm">
              <p className="font-semibold">Will be saved as drafts (missing details for publishing)</p>
              <ul className="mt-2 space-y-1">
                {incomplete.map((r) => (
                  <li key={r.row}>
                    Row {r.row}: missing {r.issues.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!report.created.length && report.valid > 0 ? (
            <button type="button" disabled={busy} onClick={() => send("commit")} className={cn(accentBtn)}>
              Import {report.valid} listings
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
