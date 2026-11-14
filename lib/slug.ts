/** URL slug helpers. Slugs never start or end with a hyphen. */

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Listing slug: `4bhk-house-for-sale-in-ramkot-kathmandu-msr-000123`. */
export function propertySlug(titleEn: string, code: string): string {
  const base = slugify(titleEn).slice(0, 80).replace(/-+$/g, "");
  const c = slugify(code);
  return base ? `${base}-${c}` : c;
}

/** Extract the listing code from a slug (used to resolve old slugs → 301). */
export function codeFromSlug(slug: string): string | null {
  const m = slug.match(/msr-(\d{6,})$/i);
  return m ? `MSR-${m[1]}` : null;
}
