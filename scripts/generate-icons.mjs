/**
 * Generate ikon PWA (any + maskable) dari SVG.
 * Jalankan: npm run gen:icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const OUT = new URL("../public/icons/", import.meta.url);

const mark = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 96 L400 176 L256 256 L112 176 Z" fill="#ffffff" opacity="0.95"/>
    <path d="M256 288 L400 208 L400 272 L256 352 L112 272 L112 208 Z" fill="#ffffff" opacity="0.72"/>
    <path d="M256 384 L400 304 L400 368 L256 448 L112 368 L112 304 Z" fill="#ffffff" opacity="0.5"/>
  </g>`;

const svg = ({ radius, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  ${mark(scale)}
</svg>`;

// maskable: konten dijaga di dalam safe zone (80%), background penuh tanpa sudut membulat
const targets = [
  { file: "icon-192.png", size: 192, radius: 112, scale: 1 },
  { file: "icon-512.png", size: 512, radius: 112, scale: 1 },
  { file: "maskable-192.png", size: 192, radius: 0, scale: 0.7 },
  { file: "maskable-512.png", size: 512, radius: 0, scale: 0.7 },
  { file: "apple-touch-icon.png", size: 180, radius: 0, scale: 0.85 },
];

await mkdir(OUT, { recursive: true });

for (const { file, size, radius, scale } of targets) {
  const buffer = await sharp(Buffer.from(svg({ radius, scale })))
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(new URL(file, OUT), buffer);
  console.log(`✓ ${file} (${size}x${size})`);
}

// favicon SVG untuk browser modern
await writeFile(new URL("icon.svg", OUT), svg({ radius: 112, scale: 1 }).trim());
console.log("✓ icon.svg");
