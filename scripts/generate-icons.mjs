/**
 * Generate PWA PNG icons from SVG.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PUBLIC = join(process.cwd(), "public");
mkdirSync(PUBLIC, { recursive: true });

function createSvg(size) {
  const fontSize = Math.round(size * 0.5);
  const radius = Math.round(size * 0.15);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#1a1a2e"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#e94560" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="${fontSize}">A</text>
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
  <text x="24" y="36" fill="#e94560" font-family="Arial,sans-serif" font-weight="bold" font-size="24">Aukcija</text>
  <text x="640" y="380" text-anchor="middle" fill="#888" font-family="Arial,sans-serif" font-size="32">Platforma za aukcije vozila</text>
</svg>`);
const wideScreenshot = await sharp(wideSvg).resize(1280, 720).png().toBuffer();
writeFileSync(join(PUBLIC, "screenshot-wide.png"), wideScreenshot);
console.log("Created screenshot-wide.png");

const narrowSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
  <rect width="390" height="844" fill="#0a0a0a"/>
  <rect x="0" y="0" width="390" height="56" fill="#1a1a2e"/>
  <text x="16" y="36" fill="#e94560" font-family="Arial,sans-serif" font-weight="bold" font-size="20">Aukcija</text>
  <text x="195" y="422" text-anchor="middle" fill="#888" font-family="Arial,sans-serif" font-size="22">Platforma za aukcije vozila</text>
</svg>`);
const narrowScreenshot = await sharp(narrowSvg).resize(390, 844).png().toBuffer();
writeFileSync(join(PUBLIC, "screenshot-narrow.png"), narrowScreenshot);
console.log("Created screenshot-narrow.png");

console.log("\nDone! Replace placeholder icons with real designs before production.");
