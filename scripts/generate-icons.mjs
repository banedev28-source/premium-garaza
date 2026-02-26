/**
 * Generate PWA PNG icons with Premium Garaza branding.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PUBLIC = join(process.cwd(), "public");
mkdirSync(PUBLIC, { recursive: true });

function createSvg(size) {
  const fontSize = Math.round(size * 0.38);
  const radius = Math.round(size * 0.18);
  const lineY1 = Math.round(size * 0.32);
  const lineY2 = Math.round(size * 0.37);
  const lineW = Math.round(size * 0.5);
  const lineX = Math.round((size - lineW) / 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <rect x="${lineX}" y="${lineY1}" width="${lineW}" height="${Math.max(2, Math.round(size * 0.02))}" rx="1" fill="#d4a843" opacity="0.3"/>
  <rect x="${lineX}" y="${lineY2}" width="${lineW}" height="${Math.max(2, Math.round(size * 0.02))}" rx="1" fill="#d4a843" opacity="0.3"/>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#d4a843" font-family="Georgia,serif" font-weight="bold" font-size="${fontSize}" letter-spacing="-1">PG</text>
</svg>`);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const png = await sharp(createSvg(size))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(join(PUBLIC, `icon-${size}x${size}.png`), png);
  console.log(`Created icon-${size}x${size}.png`);
}

// Favicon 32x32
const favicon = await sharp(createSvg(32)).resize(32, 32).png().toBuffer();
writeFileSync(join(PUBLIC, "favicon.png"), favicon);
console.log("Created favicon.png");

// Screenshot placeholders (wide + narrow)
const wideSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0a0a0a"/>
  <rect x="0" y="0" width="1280" height="56" fill="#1a1a2e"/>
  <rect x="16" y="14" width="28" height="28" rx="6" fill="#d4a843"/>
  <text x="21" y="33" fill="#1a1a2e" font-family="Georgia,serif" font-weight="bold" font-size="14">PG</text>
  <text x="52" y="36" fill="#ffffff" font-family="Arial,sans-serif" font-weight="bold" font-size="20">Premium Garaza</text>
  <text x="640" y="380" text-anchor="middle" fill="#888" font-family="Arial,sans-serif" font-size="32">Aukcije premium vozila</text>
</svg>`);
const wideScreenshot = await sharp(wideSvg).resize(1280, 720).png().toBuffer();
writeFileSync(join(PUBLIC, "screenshot-wide.png"), wideScreenshot);
console.log("Created screenshot-wide.png");

const narrowSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
  <rect width="390" height="844" fill="#0a0a0a"/>
  <rect x="0" y="0" width="390" height="56" fill="#1a1a2e"/>
  <rect x="12" y="14" width="28" height="28" rx="6" fill="#d4a843"/>
  <text x="17" y="33" fill="#1a1a2e" font-family="Georgia,serif" font-weight="bold" font-size="14">PG</text>
  <text x="48" y="36" fill="#ffffff" font-family="Arial,sans-serif" font-weight="bold" font-size="18">Premium Garaza</text>
  <text x="195" y="422" text-anchor="middle" fill="#888" font-family="Arial,sans-serif" font-size="22">Aukcije premium vozila</text>
</svg>`);
const narrowScreenshot = await sharp(narrowSvg).resize(390, 844).png().toBuffer();
writeFileSync(join(PUBLIC, "screenshot-narrow.png"), narrowScreenshot);
console.log("Created screenshot-narrow.png");

console.log("\nDone! All icons generated with Premium Garaza branding.");
