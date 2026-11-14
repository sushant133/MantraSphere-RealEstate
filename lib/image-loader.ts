/**
 * next/image loader. Uploaded photos are already resized to 400/800/1600 px
 * WebP by lib/images.ts, so we map each requested width to the nearest
 * pre-built variant instead of re-encoding on the VPS. Any other src is
 * returned unchanged (e.g. SVGs).
 */
const VARIANT_RE = /^(.*)-(400|800|1600)\.(webp|avif)$/;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const m = src.match(VARIANT_RE);
  if (!m) return src;
  const w = width <= 400 ? 400 : width <= 800 ? 800 : 1600;
  return `${m[1]}-${w}.${m[3]}`;
}
