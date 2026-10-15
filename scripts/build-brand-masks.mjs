// Builds the adaptive logo masks from the supplied emblem (public/aaa-logo.png, gold on black).
// The emblem's geometry is preserved exactly: each mask is the emblem's own brightness turned into
// transparency, with the black background and the outer glow removed. The rounded-square ring and
// the letterform are separated so each theme can colour them independently.
//   node scripts/build-brand-masks.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SOURCE = "public/aaa-logo.png";
const OUT = "public/brand";
const SIZE = 512;
const LOW = 0.32, HIGH = 0.58; // brightness below LOW (background, glow) is transparent; above HIGH is solid

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const alpha = new Float32Array(width * height);
for (let i = 0; i < width * height; i++) {
  const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2];
  const level = Math.max(r, g, b) / 255;
  alpha[i] = Math.min(1, Math.max(0, (level - LOW) / (HIGH - LOW)));
}

// Bounds of the ring (the outermost solid pixels).
let x0 = width, y0 = height, x1 = 0, y1 = 0;
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++)
    if (alpha[y * width + x] > 0.5) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
// The letterform sits well inside the ring; anything within this inset box belongs to it.
const inset = Math.round((x1 - x0) * 0.1);
const inner = (x, y) => x > x0 + inset && x < x1 - inset && y > y0 + inset && y < y1 - inset;

const pad = 6;
const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
const side = Math.min(width - left, height - top, Math.max(x1 - x0, y1 - y0) + pad * 2 + 1);
const layer = (keep) => {
  const out = Buffer.alloc(side * side * 4);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const sx = left + x, sy = top + y, o = (y * side + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = 255;
      out[o + 3] = keep(sx, sy) ? Math.round(alpha[sy * width + sx] * 255) : 0;
    }
  return sharp(out, { raw: { width: side, height: side, channels: 4 } }).resize(SIZE, SIZE, { kernel: "lanczos3" }).png({ compressionLevel: 9 });
};

mkdirSync(OUT, { recursive: true });
await layer((x, y) => !inner(x, y)).toFile(`${OUT}/aaa-mark-ring.png`);
await layer((x, y) => inner(x, y)).toFile(`${OUT}/aaa-mark-glyph.png`);
console.log(`ring bounds ${x0},${y0}–${x1},${y1}; cropped ${side}px → ${SIZE}px masks in ${OUT}/`);
