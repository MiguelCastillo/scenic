#!/usr/bin/env node
// generate-flame writes a cartoon flame as an OBJ file, for rocket exhausts,
// torches, candles, campfires, jet engines, or anything else that burns. It is
// a teardrop, brightest where it starts and darker toward its tip, which
// breaks into licking tongues. Its colors are vertex colors, meant to be drawn
// unlit so the flame glows: a material with reflectiveness 0 and a white
// ambient color shows them as they are.
//
// The flame is one unit wide at its base, which is at the origin, and it
// points down -Z. A scene places, sizes, and turns it with its transform: on
// a rocket exhaust it is placed at the exhaust and scaled by its radius (the
// rocket generator lists its rockets' exhausts), and on a torch it is turned
// to point up. Its base can start a little behind the origin, so that it
// disappears into whatever it comes out of, such as an exhaust pipe.
//
// Usage:
//   node bin/generate-flame.js                       flame.obj
//   node bin/generate-flame.js --palette blue        flame-blue.obj
//   node bin/generate-flame.js --length 2 --tongues 3 --inset 0 --out candle-flame.obj
//
// Parameters:
//   --palette: the flame's colors, one of fire, blue, or magic. fire by default.
//   --base-color, --tip-color: the colors at its base and its tip, such as
//     `--tip-color 0.2,0.4,1`, instead of the palette's.
//   --length: how long the flame is, in widths of its base. 4 by default.
//   --bulge: how much wider than its base it gets just past the base. 1.25
//     by default.
//   --tongues: how many tongues its tip breaks into. 5 by default.
//   --lick: how deep the gaps between tongues are, 0 to 1. 0.35 by default.
//   --inset: how far behind the origin its base starts, in widths of its
//     base. 0.3 by default.

const fs = require("fs");
const path = require("path");

const {Mesh, parseArgs} = require("./lib/mesh.js");
const {metaHeader, writeMeta} = require("./generate-obj-meta.js");

const defaults = {length: 4, bulge: 1.25, tongues: 5, lick: 0.35, inset: 0.3};

// Each palette is the flame's colors from its base to its tip, at t from 0 to
// 1 along it.
const palettes = {
  fire: [
    [0, [1, 1, 0.85]],
    [0.25, [1, 0.9, 0.35]],
    [0.6, [1, 0.55, 0.1]],
    [1, [0.95, 0.2, 0.05]],
  ],
  blue: [
    [0, [0.9, 0.97, 1]],
    [0.25, [0.45, 0.8, 1]],
    [0.6, [0.2, 0.4, 1]],
    [1, [0.35, 0.15, 0.85]],
  ],
  magic: [
    [0, [0.95, 1, 0.9]],
    [0.25, [0.55, 1, 0.5]],
    [0.6, [0.2, 0.85, 0.55]],
    [1, [0.55, 0.2, 0.9]],
  ],
};

// colorAt is the gradient's color at t.
function colorAt(gradient, t) {
  for (let i = 1; i < gradient.length; i++) {
    const [t1, c1] = gradient[i];
    if (t <= t1) {
      const [t0, c0] = gradient[i - 1];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return gradient[gradient.length - 1][1];
}

// buildFlame builds the flame as rings around the Z axis. Its radius swells
// just past the base and tapers to a point, and toward the tip the radius
// dips between tongues, which twist a little as they go so the flame does not
// look like a star. Normals point straight out from the axis: the flame is
// drawn unlit, so they only decide which way its triangles face.
function buildFlame({length, bulge, tongues, lick, inset}, gradient) {
  const mesh = new Mesh();
  const segments = 48;
  const steps = 40;
  const start = inset;

  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const z = start - (length + start) * t;

    // A teardrop: from the base's width, out to the bulge, down to a point.
    const swell = Math.sin(Math.min(t / 0.2, 1) * (Math.PI / 2));
    const taper = Math.pow(1 - t, 0.8);
    const radius = (1 + (bulge - 1) * swell) * taper;

    // The tongues only show past the bulge, and deepen toward the tip.
    const depth = lick * Math.max(0, (t - 0.25) / 0.75);
    const twist = t * 1.2;

    rings.push(
      Array.from({length: segments}, (_, s) => {
        const angle = (s / segments) * 2 * Math.PI;
        const wave = 0.5 + 0.5 * Math.cos(tongues * (angle + twist));
        const r = radius * (1 - depth * (1 - wave));
        const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
        return mesh.vertex([r * cos, r * sin, z], [cos, sin, 0], colorAt(gradient, t));
      })
    );
  }

  for (let i = 0; i < steps; i++) {
    for (let s = 0; s < segments; s++) {
      const t = (s + 1) % segments;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }

  return mesh;
}

function main() {
  const {
    out,
    palette = "fire",
    baseColor,
    tipColor,
    ...overrides
  } = parseArgs(process.argv.slice(2));
  if (!palettes[palette]) {
    throw new Error(
      `unknown palette "${palette}"; palettes are ${Object.keys(palettes).join(", ")}`
    );
  }

  const parameters = {...defaults};
  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in defaults)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are palette, baseColor, tipColor, ` +
          Object.keys(defaults).join(", ")
      );
    }
    parameters[name] = Number(value);
  }
  parameters.tongues = Math.round(parameters.tongues);

  // Custom base and tip colors replace the palette's ends, and its middle
  // colors blend between them.
  const color = (value) => String(value).split(",").map(Number);
  let gradient = palettes[palette];
  if (baseColor || tipColor) {
    const base = baseColor ? color(baseColor) : gradient[0][1];
    const tip = tipColor ? color(tipColor) : gradient[gradient.length - 1][1];
    gradient = [
      [0, base],
      [1, tip],
    ];
  }

  const filename = out || (palette === "fire" ? "flame.obj" : `flame-${palette}.obj`);
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const mesh = buildFlame(parameters, gradient);
  const description = {...parameters, palette, baseColor, tipColor};
  const meta = {
    generator: "bin/generate-flame.js",
    parameters: description,
  };
  const header = metaHeader(output, meta);
  fs.writeFileSync(output, mesh.toObj(header, "flame"));
  writeMeta(output, meta);

  // eslint-disable-next-line no-console
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
}

main();
