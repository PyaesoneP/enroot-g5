// The bracelet and the builder grid assume every link image is exactly
// 240 x 197 (bracelet.tsx), so the steel frames line up from link to link.
// Crops and photos rarely land on that size: this stretches each one to it
// (a few percent at most; crop close to the link's frame first). Re-run
// after adding or replacing images in public/charms/, then run
// scripts/charms-to-photo.mjs:  node scripts/charms-resize.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 240;
const HEIGHT = 197;
// Beyond this the stretch is visible: re-crop the source instead.
const MAX_STRETCH = 0.06;

const dir = path.resolve("public/charms");
let resized = 0;
let failed = 0;
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".webp")).sort()) {
  const full = path.join(dir, file);
  const input = await readFile(full);
  const { width, height } = await sharp(input).metadata();
  if (width === WIDTH && height === HEIGHT) continue;
  const stretch = Math.abs((width / height) * (HEIGHT / WIDTH) - 1);
  if (stretch > MAX_STRETCH) {
    console.error(`${file}: ${width} x ${height} is too far from ${WIDTH} x ${HEIGHT}; re-crop it`);
    failed++;
    continue;
  }
  await writeFile(full, await sharp(input).resize(WIDTH, HEIGHT, { fit: "fill" }).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  resized++;
}
console.log(`resized ${resized} image(s) to ${WIDTH} x ${HEIGHT}`);
if (failed > 0) process.exit(1);
