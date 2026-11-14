// Builds PWA / Apple icons from the logo mark. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const mark = (bg, rounded, pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect width="40" height="40" ${rounded ? 'rx="10"' : ""} fill="${bg}"/>
  <g transform="translate(20 20) scale(${1 - pad}) translate(-20 -20)">
    <circle cx="20" cy="14.5" r="5" fill="#f2a93b"/>
    <path d="M8 29.5 20 19l12 10.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 31.5v-5.2M26 31.5v-5.2" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const out = [
  ["public/icons/icon-192.png", 192, mark("#1f2a5c", true, 0)],
  ["public/icons/icon-512.png", 512, mark("#1f2a5c", true, 0)],
  // Maskable: full-bleed background, artwork inside the 80% safe zone.
  ["public/icons/maskable-512.png", 512, mark("#1f2a5c", false, 0.25)],
  ["public/icons/apple-touch-icon.png", 180, mark("#1f2a5c", false, 0.12)],
  ["public/icons/favicon-32.png", 32, mark("#1f2a5c", true, 0)],
];
for (const [file, size, svg] of out) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(file);
}
