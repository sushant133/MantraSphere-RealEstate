/**
 * Phone normalisation. Everything is stored in E.164 (`+9779812345678`,
 * `+97714621206`) so `tel:` and `wa.me` links always dial.
 */

export const NP_MOBILE_RE = /^(\+977)?9[678]\d{8}$/;
export const NP_LANDLINE_RE = /^(\+977)?0?\d{1,2}-?\d{6,7}$/;

/** Zero-width, bidi, NBSP and other invisible characters seen in pasted numbers. */
const INVISIBLE_RE = /[ ­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const DEVANAGARI = "०१२३४५६७८९";

export function cleanPhoneInput(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(INVISIBLE_RE, "")
    .replace(/[०-९]/g, (d) => String(DEVANAGARI.indexOf(d)))
    .replace(/^00/, "+")
    .replace(/[\s().]/g, "")
    .trim();
}

export type PhoneKind = "MOBILE" | "LANDLINE" | "FOREIGN";
export type NormalizedPhone = { e164: string; kind: PhoneKind };

/**
 * Normalise a phone number.
 * - Nepali numbers are validated strictly (mobile or landline).
 * - Foreign numbers are only accepted when the caller passes an explicit
 *   `countryCode` (from the country picker), never guessed.
 */
export function normalizePhone(raw: string, opts: { countryCode?: string } = {}): NormalizedPhone | null {
  const s = cleanPhoneInput(raw);
  const cc = opts.countryCode?.replace(/\D/g, "");

  if (cc && cc !== "977") {
    const digits = s.replace(/^\+/, "").replace(/-/g, "").replace(new RegExp(`^${cc}`), "").replace(/^0+/, "");
    if (!/^\d{6,12}$/.test(digits)) return null;
    const e164 = `+${cc}${digits}`;
    return e164.length <= 16 ? { e164, kind: "FOREIGN" } : null;
  }

  // Nepal: accept "977..." without the plus as well.
  const np = s.startsWith("977") ? `+${s}` : s;

  const mob = np.replace(/-/g, "");
  if (NP_MOBILE_RE.test(mob)) {
    return { e164: `+977${mob.slice(-10)}`, kind: "MOBILE" };
  }
  if (NP_LANDLINE_RE.test(mob)) {
    const local = mob.replace(/^\+977/, "").replace(/^0/, "");
    // Nepali landlines are always 8 local digits: "1" + 7 (Kathmandu valley)
    // or a 2-digit area code + 6. Prefixes 96–98 are mobile-only.
    if (/^\d{8}$/.test(local) && !/^9[678]/.test(local)) return { e164: `+977${local}`, kind: "LANDLINE" };
  }
  return null;
}

export function isValidNepaliMobile(raw: string): boolean {
  return normalizePhone(raw)?.kind === "MOBILE";
}

/** `tel:` href from an E.164 number. */
export const telHref = (e164: string) => `tel:${e164}`;

/** WhatsApp click-to-chat link with a pre-filled message. */
export function whatsappHref(e164: string, message?: string): string {
  const n = e164.replace(/\D/g, "");
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** Viber chat deep link. */
export function viberHref(e164: string): string {
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}

/** Display "+977 984-9361011" style for mobiles, "+977 1-4621206" for Kathmandu landlines. */
export function formatPhoneDisplay(e164: string): string {
  const m = e164.match(/^\+977(9\d{2})(\d{7})$/);
  if (m) return `+977 ${m[1]}-${m[2]}`;
  const l = e164.match(/^\+977(1)(\d{7})$/) ?? e164.match(/^\+977(\d{2})(\d{6})$/);
  if (l) return `+977 ${l[1]}-${l[2]}`;
  return e164;
}
