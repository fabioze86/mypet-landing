import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "public", "icons");
const APP_DIR = join(__dirname, "..", "app");

const NAVY = [0x0f, 0x17, 0x2a]; // #0F172A
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (none) per scanline
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk("IDAT", deflateSync(raw));

  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function setPixel(rgba, width, x, y, [r, g, b], alpha = 255) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = alpha;
}

function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function drawPawIcon(size, { padScale = 0.8 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(rgba, size, x, y, NAVY);
    }
  }

  const cx = size / 2;
  const cy = size / 2;
  const unit = size * padScale;

  const pad = { cx, cy: cy + unit * 0.14, rx: unit * 0.22, ry: unit * 0.17 };
  const toeRy = unit * 0.09;
  const toeRx = unit * 0.075;
  const toes = [
    { cx: cx - unit * 0.19, cy: cy - unit * 0.14 },
    { cx: cx - unit * 0.065, cy: cy - unit * 0.22 },
    { cx: cx + unit * 0.065, cy: cy - unit * 0.22 },
    { cx: cx + unit * 0.19, cy: cy - unit * 0.14 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let isWhite = inEllipse(x, y, pad.cx, pad.cy, pad.rx, pad.ry);
      if (!isWhite) {
        for (const toe of toes) {
          if (inEllipse(x, y, toe.cx, toe.cy, toeRx, toeRy)) {
            isWhite = true;
            break;
          }
        }
      }
      if (isWhite) setPixel(rgba, size, x, y, WHITE);
    }
  }

  return rgba;
}

function readPngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

mkdirSync(ICONS_DIR, { recursive: true });

const targets = [
  { dir: ICONS_DIR, file: "icon-192.png", size: 192, padScale: 0.8 },
  { dir: ICONS_DIR, file: "icon-512.png", size: 512, padScale: 0.8 },
  { dir: ICONS_DIR, file: "icon-maskable-512.png", size: 512, padScale: 0.6 }, // safe zone maior p/ maskable
  { dir: APP_DIR, file: "apple-icon.png", size: 180, padScale: 0.8 }, // convencao de arquivo do Next (auto-link)
];

for (const { dir, file, size, padScale } of targets) {
  const rgba = drawPawIcon(size, { padScale });
  const png = encodePng(size, size, rgba);
  const outPath = join(dir, file);
  writeFileSync(outPath, png);
  const { width, height } = readPngSize(png);
  if (width !== size || height !== size) {
    throw new Error(`Dimensao invalida gerada para ${file}: ${width}x${height}`);
  }
  console.log(`OK  ${file}  ${width}x${height}  ${png.length} bytes`);
}
