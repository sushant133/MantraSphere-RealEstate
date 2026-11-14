import { micromark } from "micromark";

/**
 * Markdown → HTML for CMS text (blog, legal pages, About).
 *
 * Safe by construction: micromark escapes raw HTML unless explicitly allowed
 * (we never allow it) and blanks link/image URLs whose protocol is not
 * http(s)/mailto/relative, so `javascript:` links render as `href=""`.
 * The page already has an <h1>, so Markdown headings start at <h2>.
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md?.trim()) return "";
  let html = micromark(md, { allowDangerousHtml: false, allowDangerousProtocol: false });
  // Shift headings so the highest one in the text becomes <h2> (no skipped levels under the page <h1>).
  const levels = [...html.matchAll(/<h([1-6])>/g)].map((m) => Number(m[1]));
  const shift = levels.length ? 2 - Math.min(...levels) : 0;
  if (shift) html = html.replace(/<(\/?)h([1-6])>/g, (_, slash: string, n: string) => `<${slash}h${Math.min(6, Math.max(2, Number(n) + shift))}>`);
  // External links: no referrer leakage and no ranking credit by default.
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" rel="nofollow noopener noreferrer" target="_blank"');
  // Drop empty hrefs left by blocked protocols so they are plain text, not dead links.
  html = html.replace(/<a href="">([\s\S]*?)<\/a>/g, "$1");
  html = html.replace(/<img src=""[^>]*>/g, "");
  return html;
}

/** Plain text for meta descriptions and reading time. */
export function markdownToText(md: string | null | undefined): string {
  return renderMarkdown(md)
    // Block tags become spaces; inline tags (strong, a, em…) vanish so "**text**." stays "text.".
    .replace(/<\/?(p|h\d|li|ul|ol|blockquote|pre|hr|br|table|tr|td|th)\b[^>]*>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Minutes to read at ~200 words per minute (min 1). */
export function readingMinutes(md: string | null | undefined): number {
  const words = markdownToText(md).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
