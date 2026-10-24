#!/usr/bin/env node
// generate-texture writes a seamless cartoon texture for terrain, or for tree
// bark, as a PNG file in resources/textures. Every kind wraps around at its
// edges, so it repeats across the ground, or around and up a trunk, forever
// without a seam. Its kind is one of:
// - grass: a grey detail map of soft mottling and little tufts, for grass.
//   Terrain tints it with its grass colors, so it is grey rather than green.
// - dirt: a grey detail map of mottling and small, round pebbles, for dirt.
//   Terrain tints it with its dirt color.
// - blend: where dirt shows through grass, in the alpha channel, from 0 for
//   grass to 255 for dirt, as soft-edged patches. Its color is white.
// - bark: light plates of bark split by darker grooves, which run up and
//   down it, wavering, with fine grain, for a mesh it tints, such as a tree's
//   trunk and branches (see textures on a static mesh in the README). It is
//   mostly near white, so the bark keeps the color it is painted, with its
//   grooves shading it darker.
// Detail maps are light grey on average, around 80%, so terrain brightens
// them back up by 1.25 to keep its colors as they are on average.
//
// Usage:
//   node bin/generate-texture.js --kind grass     terrain-grass.png
//   node bin/generate-texture.js --kind dirt      terrain-dirt.png
//   node bin/generate-texture.js --kind blend     terrain-blend.png
//   node bin/generate-texture.js --kind bark      bark.png
//
// Parameters:
//   --kind: grass, dirt, blend or bark. grass by default.
//   --size: how many pixels wide and tall it is, a power of 2. 256 by
//     default, and 512 for blend.
//   --seed: which random texture. 1 by default.
//   --cover: for blend, how much of the ground is dirt, 0 to 1. 0.25 by
//     default.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const {parseArgs} = require("./lib/mesh.js");

// random is a repeatable random number from 0 to 1 for the integer (x, y).
function random(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

// noise is smooth value noise at (x, y), from 0 to 1, that repeats every
// period in both directions, so a texture made from it tiles.
function noise(x, y, period, seed) {
  const [ix, iy] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - ix, y - iy];
  const fade = (t) => t * t * (3 - 2 * t);
  const [ux, uy] = [fade(fx), fade(fy)];
  const at = (i, j) =>
    random(((i % period) + period) % period, ((j % period) + period) % period, seed);
  const [a, b, c, d] = [at(ix, iy), at(ix + 1, iy), at(ix, iy + 1), at(ix + 1, iy + 1)];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// fbm is a few octaves of noise, cells cells across the texture at first,
// from 0 to 1.
function fbm(u, v, cells, octaves, seed) {
  let [sum, amplitude, total] = [0, 0.5, 0];
  for (let o = 0; o < octaves; o++) {
    const period = cells << o;
    sum += amplitude * noise(u * period, v * period, period, seed + o * 13);
    total += amplitude;
    amplitude /= 2;
  }
  return sum / total;
}

// dabs calls draw for count round dabs scattered over the texture, with
// their centers and radii in texture coordinates, and each dab is drawn
// again on the far side of any edge it crosses, so they wrap around.
function dabs(count, minRadius, maxRadius, seed, draw) {
  for (let i = 0; i < count; i++) {
    const [x, y] = [random(i, 1, seed), random(i, 2, seed)];
    const radius = minRadius + (maxRadius - minRadius) * random(i, 3, seed);
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        draw(x + dx, y + dy, radius, i);
      }
    }
  }
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Each kind fills pixels, an RGBA array, size by size.
const kinds = {
  grass(pixels, size, {seed}) {
    const grey = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        grey[y * size + x] = 0.72 + 0.16 * fbm(x / size, y / size, 4, 3, seed);
      }
    }
    // Tufts: little bright blades with a soft shadow below each one.
    dabs(900, 0.006, 0.014, seed + 5, (cx, cy, r, i) => {
      const lighter = 0.1 + 0.08 * random(i, 4, seed);
      paint(grey, size, cx, cy + r * 0.6, r * 1.2, (d) => -0.08 * (1 - d));
      paint(grey, size, cx, cy, r, (d) => lighter * (1 - d * d));
    });
    fill(pixels, grey);
  },

  dirt(pixels, size, {seed}) {
    const grey = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        grey[y * size + x] = 0.7 + 0.18 * fbm(x / size, y / size, 3, 4, seed);
      }
    }
    // Pebbles: round and lit from above, with a shadow on their lower side.
    dabs(160, 0.008, 0.02, seed + 7, (cx, cy, r) => {
      paint(grey, size, cx, cy + r * 0.35, r * 1.15, (d) => -0.12 * (1 - d));
      paint(grey, size, cx, cy, r, (d) => 0.14 * (1 - d * d * d));
    });
    fill(pixels, grey);
  },

  bark(pixels, size, {seed}) {
    const grey = new Float32Array(size * size);
    // The grooves are where a few waves across the texture, wavered by noise
    // running up it, are near their highest, so they run up and down,
    // splitting the bark into long plates. They widen and narrow along their
    // length, and the plates have fine grain. Everything repeats, across in
    // whole waves and up in whole cells of noise, so it tiles.
    const grooves = 5;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const [u, v] = [x / size, y / size];
        const waver = 0.9 * (fbm(u, v, 3, 3, seed) - 0.5);
        const wave = 0.5 + 0.5 * Math.cos(2 * Math.PI * (u * grooves + waver));
        const width = 0.62 + 0.3 * fbm(u, v, 4, 2, seed + 5);
        const groove = smoothstep(width, width + 0.18, wave);
        const grain = fbm(u, v, 24, 2, seed + 9);
        grey[y * size + x] = 0.98 - 0.45 * groove - 0.14 * grain;
      }
    }
    fill(pixels, grey);
  },

  blend(pixels, size, {seed, cover}) {
    // Patches are where the noise is highest, cover of the texture, with a
    // soft edge.
    const values = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        values.push(fbm(x / size, y / size, 3, 4, seed));
      }
    }
    const edge = [...values].sort((a, b) => a - b)[Math.floor((1 - cover) * values.length)];
    values.forEach((v, i) => {
      pixels.set([255, 255, 255, Math.round(255 * smoothstep(edge - 0.03, edge + 0.03, v))], i * 4);
    });
  },
};

// paint adds shade(d) to grey within radius of (cx, cy), in texture
// coordinates, where d is how far out from the center, from 0 to 1.
function paint(grey, size, cx, cy, radius, shade) {
  const [x0, x1] = [Math.floor((cx - radius) * size), Math.ceil((cx + radius) * size)];
  const [y0, y1] = [Math.floor((cy - radius) * size), Math.ceil((cy + radius) * size)];
  for (let y = Math.max(0, y0); y <= Math.min(size - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(size - 1, x1); x++) {
      const d = Math.hypot((x + 0.5) / size - cx, (y + 0.5) / size - cy) / radius;
      if (d < 1) {
        grey[y * size + x] += shade(d);
      }
    }
  }
}

// fill sets pixels to the opaque greys in grey.
function fill(pixels, grey) {
  grey.forEach((g, i) => {
    const v = Math.round(255 * Math.min(1, Math.max(0, g)));
    pixels.set([v, v, v, 255], i * 4);
  });
}

// png encodes RGBA pixels, size by size, as a PNG file.
function png(pixels, size) {
  const crcTable = Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) {
      c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, check]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits per channel, RGBA

  // Each row starts with a 0, for no filter.
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function main() {
  const {kind = "grass", size, seed = 1, cover = 0.25, out} = parseArgs(process.argv.slice(2));
  if (!kinds[kind]) {
    throw new Error(`unknown kind "${kind}"; kinds are ${Object.keys(kinds).join(", ")}`);
  }
  const pixelSize = Number(size || (kind === "blend" ? 512 : 256));
  if (pixelSize & (pixelSize - 1)) {
    throw new Error(`size must be a power of 2, so the texture can repeat, not ${size}`);
  }

  const pixels = new Uint8Array(pixelSize * pixelSize * 4);
  kinds[kind](pixels, pixelSize, {seed: Number(seed), cover: Number(cover)});

  const filename = out || (kind === "bark" ? "bark.png" : `terrain-${kind}.png`);
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "textures", filename);
  fs.writeFileSync(output, png(pixels, pixelSize));

  // eslint-disable-next-line no-console
  console.log(`wrote ${output}: ${pixelSize}x${pixelSize}`);
}

main();
