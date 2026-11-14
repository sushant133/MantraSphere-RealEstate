/**
 * Builds the normalised `searchKeywords` array stored on each property so
 * MongoDB `$text` search tolerates common romanisation differences:
 * "bhaktapur" / "bhaktpur" / "भक्तपुर", "kathmandu" / "kathmandau", etc.
 */

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const isConsonant = (c: string | undefined) => !!c && /[a-z]/.test(c) && !VOWELS.has(c);

const SWAPS: [RegExp, string][] = [
  [/aa/g, "a"],
  [/ee/g, "i"],
  [/oo/g, "u"],
  [/w/g, "v"],
  [/v/g, "w"],
  [/sh/g, "s"],
  [/ph/g, "f"],
  [/chh/g, "ch"],
  [/z/g, "j"],
];

/** Lower-case, strip punctuation; keeps Devanagari intact. */
export function normalizeToken(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Romanisation variants of one latin word. */
export function latinVariants(word: string): string[] {
  const w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w)) return [w];
  const out = new Set<string>([w]);

  // Schwa deletion: drop a single inner "a" sitting between two consonants.
  for (let i = 1; i < w.length - 1; i++) {
    if (w[i] === "a" && isConsonant(w[i - 1]) && isConsonant(w[i + 1])) {
      out.add(w.slice(0, i) + w.slice(i + 1));
    }
  }
  for (const [re, rep] of SWAPS) {
    if (re.test(w)) out.add(w.replace(re, rep));
    re.lastIndex = 0;
  }
  return [...out].filter((x) => x.length >= 3);
}

/** All keywords for a set of place names / terms (English + Nepali). */
export function buildSearchKeywords(terms: (string | undefined | null)[]): string[] {
  const out = new Set<string>();
  for (const t of terms) {
    if (!t) continue;
    const norm = normalizeToken(t);
    if (!norm) continue;
    for (const word of norm.split(" ")) {
      if (word.length < 2) continue;
      for (const v of latinVariants(word)) out.add(v);
    }
    const joined = norm.replace(/\s+/g, "");
    if (joined !== norm && joined.length >= 3) out.add(joined);
  }
  return [...out].slice(0, 200);
}
