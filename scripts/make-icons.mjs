/**
 * Generates the PWA icons as PNGs, with no image library involved.
 *
 * The container this project is developed from has no ImageMagick, no canvas and
 * no PIL, so the icons are rasterised into an RGBA buffer by hand and encoded
 * with Node's built-in zlib. Run `npm run icons` after changing the artwork.
 *
 * Artwork: a vinyl record — concentric amber grooves on near-black, with the
 * label and spindle hole punched out. Reads clearly at 32px.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const INK = [0x0b, 0x0b, 0x0f];
const AMBER = [0xf5, 0xa5, 0x24];
const AMBER_DIM = [0x8a, 0x5c, 0x14];
const LABEL = [0xe8, 0x4c, 0x3d];

/** Linear interpolation between two colours, `t` in [0,1]. */
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/**
 * Coverage of a disc edge at distance `d` from the centre, antialiased over one
 * pixel. Returns 1 well inside the radius, 0 well outside.
 */
const edge = (d, radius) => Math.max(0, Math.min(1, radius + 0.5 - d));

function render(size) {
  const px = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const outer = size * 0.46;
  const labelR = size * 0.155;
  const holeR = size * 0.045;

  // Groove rings live between the label and the outer rim.
  const grooveFrom = labelR + size * 0.035;
  const grooveTo = outer - size * 0.04;
  const grooveCount = Math.max(4, Math.round(size / 40));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      let rgb = INK;
      let alpha = 1;

      const disc = edge(d, outer);
      if (disc > 0) {
        // Base disc: a dark charcoal that lifts slightly towards the rim so the
        // record reads as a physical object rather than a flat circle.
        let body = mix([0x18, 0x18, 0x1f], [0x2a, 0x2a, 0x33], d / outer);

        if (d >= grooveFrom && d <= grooveTo) {
          // Sinusoidal grooves, brightest at the crest.
          const phase = ((d - grooveFrom) / (grooveTo - grooveFrom)) * grooveCount;
          const crest = (Math.cos(phase * Math.PI * 2) + 1) / 2;
          body = mix(body, mix(AMBER_DIM, AMBER, crest), 0.55 * crest);
        }

        if (d <= labelR) {
          body = mix(body, LABEL, edge(d, labelR));
        }
        // Spindle hole punches through to the background.
        const hole = edge(d, holeR);
        body = mix(body, INK, hole);

        rgb = mix(INK, body, disc);
      }

      const i = (y * size + x) * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // One filter byte (0 = None) per scanline, as the PNG spec requires.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [180, 192, 512]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, encodePng(render(size), size));
  console.log(`wrote ${file}`);
}
