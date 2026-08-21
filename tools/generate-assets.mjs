import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");

function image(width, height, color = [0, 0, 0, 0]) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) pixels.set(color, i * 4);
  return { width, height, pixels };
}
function pixel(target, x, y, color) {
  if (x >= 0 && y >= 0 && x < target.width && y < target.height) target.pixels.set(color, (y * target.width + x) * 4);
}
function rect(target, x, y, width, height, color) {
  for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) pixel(target, px, py, color);
}
function line(target, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, steps));
    const y = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, steps));
    rect(target, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, color);
  }
}

function heartTop() {
  const t = image(16, 16, [19, 17, 23, 255]);
  const iron = [67, 68, 76, 255], edge = [11, 10, 14, 255], red = [130, 14, 25, 255], glow = [255, 65, 37, 255], gold = [190, 137, 32, 255];
  rect(t, 0, 0, 16, 2, edge); rect(t, 0, 14, 16, 2, edge); rect(t, 0, 0, 2, 16, edge); rect(t, 14, 0, 2, 16, edge);
  rect(t, 2, 2, 12, 12, iron);
  for (const [x, y] of [[2,2],[12,2],[2,12],[12,12]]) rect(t, x, y, 2, 2, gold);
  line(t, 3, 8, 13, 8, red, 2); line(t, 8, 3, 8, 13, red, 2);
  rect(t, 6, 6, 4, 4, glow); pixel(t, 7, 6, [255, 211, 100, 255]);
  return t;
}
function heartSide() {
  const t = image(16, 16, [27, 25, 31, 255]);
  const dark = [13, 12, 17, 255], iron = [70, 66, 75, 255], red = [116, 12, 22, 255], gold = [177, 126, 28, 255];
  rect(t, 0, 0, 16, 2, dark); rect(t, 0, 14, 16, 2, dark); rect(t, 0, 0, 2, 16, dark); rect(t, 14, 0, 2, 16, dark);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if ((x * 3 + y * 5) % 7 < 2) pixel(t, x, y, iron);
  rect(t, 3, 6, 10, 4, red); rect(t, 6, 4, 4, 8, red); rect(t, 7, 7, 2, 2, [255, 63, 35, 255]);
  for (const [x, y] of [[2,2],[12,2],[2,12],[12,12]]) rect(t, x, y, 2, 2, gold);
  return t;
}
function icon() {
  const t = image(256, 256, [10, 9, 14, 255]);
  const sky = [27, 18, 31, 255], stone = [39, 40, 48, 255], trim = [74, 66, 78, 255], red = [137, 15, 27, 255], moon = [178, 170, 154, 255];
  for (let y = 0; y < 256; y++) rect(t, 0, y, 256, 1, [10 + Math.floor(y / 32), 8 + Math.floor(y / 48), 18 + Math.floor(y / 16), 255]);
  rect(t, 175, 25, 45, 45, moon); rect(t, 184, 18, 44, 46, sky);
  // Castle silhouette.
  rect(t, 35, 105, 186, 120, stone); rect(t, 20, 75, 48, 150, stone); rect(t, 188, 75, 48, 150, stone); rect(t, 82, 66, 92, 159, stone);
  for (const x of [20, 36, 52, 82, 102, 122, 142, 162, 188, 204, 220]) rect(t, x, 58 + (x > 68 && x < 180 ? 0 : 10), 12, 28, trim);
  rect(t, 112, 151, 32, 74, [17, 14, 20, 255]); rect(t, 119, 165, 18, 60, red);
  // Dragon body, tail, head, and vast wings.
  line(t, 90, 94, 166, 86, [5, 5, 7, 255], 13); line(t, 158, 89, 202, 117, [5, 5, 7, 255], 7);
  line(t, 104, 91, 44, 35, [5, 5, 7, 255], 8); line(t, 105, 93, 27, 78, [5, 5, 7, 255], 8);
  line(t, 139, 89, 190, 31, [5, 5, 7, 255], 8); line(t, 138, 91, 229, 66, [5, 5, 7, 255], 8);
  rect(t, 70, 75, 32, 20, [5, 5, 7, 255]); rect(t, 68, 82, 8, 4, red);
  // Border.
  rect(t, 0, 0, 256, 8, red); rect(t, 0, 248, 256, 8, red); rect(t, 0, 0, 8, 256, red); rect(t, 248, 0, 8, 256, red);
  return t;
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const tb = Buffer.from(type, "ascii"), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([tb, data]))); return Buffer.concat([length, tb, data, crc]); }
function encodePng(target) {
  const header = Buffer.alloc(13); header.writeUInt32BE(target.width, 0); header.writeUInt32BE(target.height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(target.height * (1 + target.width * 4));
  for (let y = 0; y < target.height; y++) { const start = y * (1 + target.width * 4); rows[start] = 0; Buffer.from(target.pixels.buffer, target.pixels.byteOffset + y * target.width * 4, target.width * 4).copy(rows, start + 1); }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
async function save(path, target) { const full = resolve(root, path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, encodePng(target)); console.log(`generated ${path}`); }

await save("packs/DarkCastle_RP/textures/dark_castle/dark_castle/ddx56_top.png", heartTop());
await save("packs/DarkCastle_RP/textures/dark_castle/dark_castle/ddx56_side.png", heartSide());
const packIcon = icon();
await save("packs/DarkCastle_RP/pack_icon.png", packIcon);
await save("packs/DarkCastle_BP/pack_icon.png", packIcon);
