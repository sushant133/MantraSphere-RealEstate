import { toDevanagariDigits } from "./price";

/** "21 Nov 2026" / "२१ नोभेम्बर २०२६" in Nepal time. */
export function formatDateLike(d: Date, ne: boolean): string {
  const s = new Intl.DateTimeFormat(ne ? "ne-NP" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" }).format(d);
  return ne ? toDevanagariDigits(s) : s;
}
