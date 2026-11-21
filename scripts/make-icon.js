// Turns Zaal.ico into build/icon.png (Linux needs a PNG). No extra packages needed.
// Run automatically by "npm run dist:linux". Skipped if build/icon.png already exists.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const out = path.join(root, 'build', 'icon.png');
if (fs.existsSync(out)) { console.log('build/icon.png already exists, keeping it'); process.exit(0); }

const ico = fs.readFileSync(process.argv[2] || path.join(root, 'Zaal.ico'));
const count = ico.readUInt16LE(4);
let best = null;
for (let i = 0; i < count; i++) {
  const e = 6 + i * 16;
  const w = ico[e] || 256;
  const size = ico.readUInt32LE(e + 8), offset = ico.readUInt32LE(e + 12);
  if (!best || w > best.w) best = { w, size, offset };
}
const data = ico.subarray(best.offset, best.offset + best.size);

let png;
if (data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
  png = data; // the icon already holds a PNG
} else {
  // Old-style bitmap: 40 byte header, then 32-bit BGRA rows stored bottom to top
  const w = data.readInt32LE(4);
  const h = Math.abs(data.readInt32LE(8)) / 2;
  const bpp = data.readUInt16LE(14);
  if (bpp !== 32) { console.error('Icon is ' + bpp + '-bit. Put a 512x512 PNG at build/icon.png yourself.'); process.exit(1); }
  const px = data.subarray(data.readUInt32LE(0));
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4, dst = y * (w * 4 + 1);
    raw[dst] = 0;
    for (let x = 0; x < w; x++) {
      raw[dst + 1 + x * 4] = px[src + x * 4 + 2];     // R
      raw[dst + 2 + x * 4] = px[src + x * 4 + 1];     // G
      raw[dst + 3 + x * 4] = px[src + x * 4];         // B
      raw[dst + 4 + x * 4] = px[src + x * 4 + 3];     // A
    }
  }
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6;
  png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Wrote build/icon.png');
