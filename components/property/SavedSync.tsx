"use client";

import { useEffect } from "react";
import { syncSaved } from "./SaveButton";

/** Mounted in the dashboard: merges this device's saved list with the account once per visit. */
export function SavedSync() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("msr:saved-synced")) return;
      sessionStorage.setItem("msr:saved-synced", "1");
    } catch {
      /* ignore */
    }
    void syncSaved();
  }, []);
  return null;
}
