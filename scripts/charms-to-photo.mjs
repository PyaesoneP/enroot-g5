// Telegram sendPhoto does not reliably take WebP and re-encodes photos as
// JPEG (transparency turns black), so the bot posts flattened JPEG copies of
// the catalogue charms (ADR-010). Re-run after editing content/charms.json
// or public/charms/:  node scripts/charms-to-photo.mjs
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SIZE = 512;
const BG = { r: 255, g: 250, b: 245, alpha: 1 };

const { charms } = JSON.parse(await readFile("content/charms.json", "utf8"));
const out = path.resolve("public/charms-photo");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const { id } of charms) {
  const charm = await sharp(`public/charms/${id}.webp`)
    .resize({ width: SIZE - 96, height: SIZE - 96, fit: "inside" })
    .toBuffer();
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: BG } })
    .composite([{ input: charm, gravity: "centre" }])
    .flatten({ background: BG })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(path.join(out, `${id}.jpg`));
}
console.log(`wrote ${charms.length} charm JPEGs to public/charms-photo/`);
