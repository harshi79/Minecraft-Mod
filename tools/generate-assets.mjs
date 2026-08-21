import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");

function image(width, height, color = [0, 0, 0, 0]) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels.set(color, i * 4);
  }
  return { width, height, pixels };
}

function setPixel(target, x, y, color) {
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return;
  target.pixels.set(color, (y * target.width + x) * 4);
}

function fillRect(target, x, y, width, height, color) {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) setPixel(target, px, py, color);
  }
}

function fillPolygon(target, points, color) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > y + 0.5 !== yj > y + 0.5) {
          const crossingX = ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi;
          if (x + 0.5 < crossingX) inside = !inside;
        }
      }
      if (inside) setPixel(target, x, y, color);
    }
  }
}

function crystalTexture() {
  const target = image(16, 16);
  const outline = [31, 10, 57, 255];
  const purple = [128, 48, 220, 255];
  const violet = [182, 86, 255, 255];
  const blue = [45, 190, 255, 255];
  const pale = [211, 239, 255, 255];

  fillPolygon(target, [[8, 0], [12, 3], [11, 7], [14, 10], [9, 16], [7, 13], [4, 16], [3, 10], [5, 7], [4, 3]], outline);
  fillPolygon(target, [[8, 1], [11, 4], [10, 8], [13, 10], [9, 14], [8, 11], [5, 14], [4, 10], [6, 7], [5, 4]], purple);
  fillPolygon(target, [[8, 1], [11, 4], [9, 8], [8, 11], [6, 7]], violet);
  fillPolygon(target, [[8, 1], [9, 8], [6, 7]], blue);
  fillPolygon(target, [[9, 8], [13, 10], [9, 14], [8, 11]], [70, 84, 205, 255]);
  setPixel(target, 7, 3, pale);
  setPixel(target, 8, 4, pale);
  setPixel(target, 2, 6, blue);
  setPixel(target, 13, 5, violet);
  setPixel(target, 1, 7, pale);
  setPixel(target, 14, 4, pale);
  return target;
}

function voidstoneTexture() {
  const target = image(16, 16, [27, 17, 40, 255]);
  const palette = [
    [35, 22, 52, 255],
    [45, 27, 65, 255],
    [57, 32, 78, 255],
    [25, 15, 36, 255],
    [71, 37, 93, 255],
  ];

  let seed = 0x5eedc0de;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const wave = Math.sin((x + y * 1.7) * 0.65) * 0.5 + 0.5;
      const index = Math.min(palette.length - 1, Math.floor((random() * 0.65 + wave * 0.35) * palette.length));
      setPixel(target, x, y, palette[index]);
    }
  }

  for (const [x, y] of [[2, 3], [3, 3], [11, 2], [7, 8], [8, 8], [13, 12], [4, 14]]) {
    setPixel(target, x, y, [104, 49, 137, 255]);
  }
  return target;
}

function anchorTopTexture() {
  const target = image(16, 16, [18, 9, 30, 255]);
  const dark = [36, 18, 54, 255];
  const purple = [118, 45, 177, 255];
  const cyan = [46, 195, 222, 255];
  const glow = [186, 245, 255, 255];

  for (let i = 0; i < 16; i++) {
    setPixel(target, i, 0, dark); setPixel(target, i, 15, dark);
    setPixel(target, 0, i, dark); setPixel(target, 15, i, dark);
  }
  for (let i = 2; i <= 13; i++) {
    setPixel(target, i, 2, purple); setPixel(target, i, 13, purple);
    setPixel(target, 2, i, purple); setPixel(target, 13, i, purple);
  }
  for (let i = 4; i <= 11; i++) {
    setPixel(target, i, 4, cyan); setPixel(target, i, 11, cyan);
    setPixel(target, 4, i, cyan); setPixel(target, 11, i, cyan);
  }
  fillPolygon(target, [[8, 4], [11, 8], [8, 12], [4, 8]], [73, 29, 112, 255]);
  fillPolygon(target, [[8, 5], [10, 8], [8, 11], [6, 8]], cyan);
  fillRect(target, 7, 7, 2, 2, glow);
  for (const [x, y] of [[1, 4], [14, 11], [4, 14], [11, 1]]) setPixel(target, x, y, cyan);
  return target;
}

function anchorSideTexture() {
  const target = image(16, 16, [22, 11, 34, 255]);
  const stone = [42, 22, 59, 255];
  const purple = [95, 38, 132, 255];
  const cyan = [37, 175, 207, 255];

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if ((x * 5 + y * 3) % 11 < 3) setPixel(target, x, y, stone);
    }
  }
  for (let y = 0; y < 16; y++) {
    setPixel(target, 3, y, y % 3 === 0 ? cyan : purple);
    setPixel(target, 12, y, y % 3 === 1 ? cyan : purple);
  }
  for (let x = 4; x <= 11; x++) {
    setPixel(target, x, 7, purple);
    setPixel(target, x, 8, x === 7 || x === 8 ? cyan : purple);
  }
  return target;
}

function packIcon(crystal) {
  const target = image(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = x - 128;
      const dy = y - 128;
      const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 181);
      const ring = Math.max(0, Math.sin(Math.sqrt(dx * dx + dy * dy) * 0.15)) * (1 - distance) * 15;
      setPixel(target, x, y, [Math.round(14 + ring), Math.round(6 + ring * 0.3), Math.round(28 + (1 - distance) * 30 + ring), 255]);
    }
  }

  // Portal-like frame.
  for (let i = 0; i < 8; i++) {
    const color = i < 3 ? [47, 198, 226, 255] : [116, 48, 178, 255];
    const inset = 22 + i;
    for (let x = inset; x < 256 - inset; x++) {
      setPixel(target, x, inset, color);
      setPixel(target, x, 255 - inset, color);
    }
    for (let y = inset; y < 256 - inset; y++) {
      setPixel(target, inset, y, color);
      setPixel(target, 255 - inset, y, color);
    }
  }

  // Enlarge the 16x16 item art without smoothing to preserve pixel style.
  const scale = 10;
  const offsetX = 128 - (16 * scale) / 2;
  const offsetY = 128 - (16 * scale) / 2;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const index = (y * 16 + x) * 4;
      const color = Array.from(crystal.pixels.slice(index, index + 4));
      if (color[3] === 0) continue;
      fillRect(target, offsetX + x * scale, offsetY + y * scale, scale, scale, color);
    }
  }
  return target;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(target) {
  const { width, height, pixels } = target;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    scanlines[rowStart] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(scanlines, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function save(relativePath, target) {
  const path = resolve(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encodePng(target));
  console.log(`generated ${relativePath}`);
}

const crystal = crystalTexture();
const icon = packIcon(crystal);

await save("packs/CrystalVoid_RP/textures/crystal_void/crystal_void/dimension_crystal.png", crystal);
await save("packs/CrystalVoid_RP/textures/crystal_void/crystal_void/voidstone.png", voidstoneTexture());
await save("packs/CrystalVoid_RP/textures/crystal_void/crystal_void/void_anchor_top.png", anchorTopTexture());
await save("packs/CrystalVoid_RP/textures/crystal_void/crystal_void/void_anchor_side.png", anchorSideTexture());
await save("packs/CrystalVoid_RP/pack_icon.png", icon);
await save("packs/CrystalVoid_BP/pack_icon.png", icon);
