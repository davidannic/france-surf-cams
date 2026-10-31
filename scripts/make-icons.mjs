// Draws the app icon (sun over two waves) as SVG and PNGs into ../icons/.
// Usage: node scripts/make-icons.mjs   (Node 18+, no dependencies)

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import zlib from "node:zlib";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "icons");
const SIZES = [180, 192, 512];

const BG = [7, 11, 20];
const SUN = [250, 204, 21];
const WAVE1 = [56, 189, 248];
const WAVE2 = [14, 116, 144];

// Shapes in unit coordinates (0..1), y pointing down.
const sun = { x: 0.64, y: 0.36, r: 0.15 };
const wave1 = (x) => 0.58 + 0.07 * Math.sin(2 * Math.PI * (1.1 * x) + 0.6);
const wave2 = (x) => 0.73 + 0.05 * Math.sin(2 * Math.PI * (1.3 * x) + 2.2);

function colorAt(x, y) {
  if (y > wave2(x)) return WAVE2;
  if (y > wave1(x)) return WAVE1;
  if ((x - sun.x) ** 2 + (y - sun.y) ** 2 < sun.r ** 2) return SUN;
  return BG;
}

// 4×4 supersampling for smooth edges.
function render(size) {
  const ss = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1);
    raw[row] = 0; // PNG filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = colorAt((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const n = ss * ss, o = row + 1 + px * 3;
      raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n);
    }
  }
  return png(size, size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function svg() {
  const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  const wavePath = (f) => {
    const pts = [];
    for (let i = 0; i <= 64; i++) { const x = i / 64; pts.push(`${(x * 100).toFixed(2)},${(f(x) * 100).toFixed(2)}`); }
    return `M0,100 L${pts.join(" L")} L100,100 Z`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="18" fill="${hex(BG)}"/>
<circle cx="${sun.x * 100}" cy="${sun.y * 100}" r="${sun.r * 100}" fill="${hex(SUN)}"/>
<path d="${wavePath(wave1)}" fill="${hex(WAVE1)}"/>
<path d="${wavePath(wave2)}" fill="${hex(WAVE2)}"/>
</svg>
`;
}

await mkdir(DIR, { recursive: true });
await writeFile(path.join(DIR, "icon.svg"), svg());
for (const s of SIZES) await writeFile(path.join(DIR, `icon-${s}.png`), render(s));
console.log(`Icons written to ${DIR}`);
