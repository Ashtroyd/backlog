// Generates the PWA / home-screen icons from an inline SVG.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="${pad ? 0 : 116}" fill="#faf9f5"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Georgia, 'Times New Roman', serif" font-weight="700"
        font-size="300" fill="#262521">B<tspan fill="#c96442">.</tspan></text>
</svg>`;

const rounded = Buffer.from(svg(false));
const square = Buffer.from(svg(true)); // maskable: full-bleed, OS crops

await sharp(rounded).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(square).resize(512, 512).png().toFile("public/icon-512.png");
await sharp(rounded).resize(180, 180).png().toFile("public/apple-touch-icon.png");
writeFileSync(
  "public/icon.svg",
  svg(false).replace('width="512" height="512"', 'width="512" height="512" viewBox="0 0 512 512"'),
);
console.log("icons written to public/");
