#!/usr/bin/env node
// generate-gate writes a race gate as an OBJ file, in smooth, simple shapes
// striped in the palette's colors, for racers to fly through. Its shape is one
// of:
// - ring: a round tube bent into a ring around the origin, in stripes, for
//   the gates along a course.
// - gantry: two square posts standing on the ground with a beam across their
//   tops, for a start line or a gate wide enough for racers side by side. The
//   posts are banded in the palette's colors, and the beam is two rows of
//   blocks that take turns with them, like a checkerboard.
// - sign: a flat cream board with a frame, held up by a slim post, to stand
//   on top of a gate like a road sign, wide enough for a number of digits.
//   The bottom of the post is at the origin, to sit on the gate's top, and
//   the board's face is toward -Z, the side racers come from.
// - digit: one digit, 0 to 9, in flat blocks, to put on a sign's face. Any
//   number is made from these on a sign with room for its digits: digit d,
//   counting from 0 on the left, of an n digit number goes at
//   ((2n - 2 - 4d) * dot, post + (5 * dot + 100) / 2, -8) in the sign's
//   space, so with the defaults, a 1 digit number at (0, 282.5, -8), and a 2
//   digit one at (90, 282.5, -8) and (-90, 282.5, -8).
// Everything is colored with vertex colors, so it renders without a material
// color: the lit shaders add the material color to the vertex color, so leave
// it black, or use it to make a gate glow, as a race does to show which gate
// is next (see games/bubble-squadron/scripts/race.js).
//
// Ring and gantry stand in the XY plane, so racers fly through them along Z.
// The ring is around the origin, and its radius is the radius of the circle
// through the middle of its tube. The gantry's opening is width wide and
// height tall, with its bottom at the origin, on the ground: a race (see
// race.js) counts a racer flying through it anywhere in that opening, given
// the same width and height in the gate's "gate" state.
//
// Usage:
//   node bin/generate-gate.js                      race-gate.obj
//   node bin/generate-gate.js --palette checker    race-gate-checker.obj
//   node bin/generate-gate.js --shape gantry --palette checker
//                                                  race-gantry-checker.obj, for a start line
//   node bin/generate-gate.js --shape sign --digits 2
//                                                  race-sign-2.obj, a sign for 2 digits
//   node bin/generate-gate.js --shape digit --number 7 --palette ink
//                                                  race-digit-7-ink.obj
//   node bin/generate-gate.js --radius 400 --stripes 24 --out big-gate.obj
//
// Parameters:
//   --shape: ring, gantry, sign or digit. ring by default.
//   --palette: the colors, one of candy, checker, mint, berry, cyan or ink, taken
//     in turn by the stripes and blocks, or for a digit, its color. candy by
//     default. A sign is always cream with a pink frame.
//   --radius: the ring's radius. 300 by default.
//   --thickness: how thick the ring's tube is, and half as thick as the
//     gantry's posts and beam are deep. 45 by default.
//   --stripes: how many stripes go around the ring. 20 by default.
//   --width, --height: the size of the gantry's opening. 2000 and 800 by
//     default.
//   --block: the size of the blocks of the gantry's beam and the bands of its
//     posts. 80 by default.
//   --digits: how many digits a sign is wide enough for. 1 by default.
//   --number: the digit, 0 to 9. 1 by default.
//   --post: how tall the sign's post is. 120 by default.
//   --dot: the size of the blocks digits are made of, which sets how big a
//     sign is for them. 45 by default.

const fs = require("fs");
const path = require("path");

const {Mesh, add, box, parseArgs} = require("./lib/mesh.js");
const {metaHeader, writeMeta} = require("./generate-obj-meta.js");

const defaults = {
  radius: 300,
  thickness: 45,
  stripes: 20,
  width: 2000,
  height: 800,
  block: 80,
  digits: 1,
  number: 1,
  post: 120,
  dot: 45,
};

// Each palette's colors take turns along a gate.
const palettes = {
  candy: [
    [1, 0.42, 0.5],
    [1, 0.93, 0.82],
  ],
  checker: [
    [0.12, 0.12, 0.16],
    [0.96, 0.96, 0.96],
  ],
  mint: [
    [0.35, 0.85, 0.7],
    [0.92, 1, 0.95],
  ],
  berry: [
    [0.6, 0.35, 0.95],
    [1, 0.75, 0.9],
  ],
  cyan: [
    [0.16, 0.88, 1],
    [0.85, 0.98, 1],
  ],
  ink: [[0.16, 0.2, 0.5]],
};

// A sign's board, and its frame and post.
const board = [1, 0.97, 0.9];
const frame = [1, 0.5, 0.6];

// Resolution of the ring: steps around it, and sides around its tube.
const AROUND = 80;
const SIDES = 16;

// buildRing sweeps a round tube around a circle, its stripes changing color
// at the same spots around it, so each stripe has its own vertices and the
// colors meet in a crisp line.
function buildRing({radius, thickness, stripes}, colors) {
  const mesh = new Mesh();
  const steps = Math.ceil(AROUND / stripes) * stripes;
  for (let stripe = 0; stripe < stripes; stripe++) {
    const color = colors[stripe % colors.length];
    const from = (stripe * steps) / stripes;
    const rings = [];
    for (let i = from; i <= from + steps / stripes; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const out = [Math.cos(angle), Math.sin(angle), 0];
      rings.push(
        Array.from({length: SIDES}, (_, s) => {
          const turn = (s / SIDES) * 2 * Math.PI;
          const normal = [out[0] * Math.cos(turn), out[1] * Math.cos(turn), Math.sin(turn)];
          const position = out.map((v, k) => v * radius + normal[k] * thickness);
          return mesh.vertex(position, normal, color);
        })
      );
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let s = 0; s < SIDES; s++) {
        const t = (s + 1) % SIDES;
        mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
      }
    }
  }
  return mesh;
}

// buildGantry stands a square post on each side of the opening, banded a
// block tall at a time, and lays a beam two blocks tall across their tops,
// its blocks taking turns with the colors in both rows, offset by one, so they
// make a checkerboard.
function buildGantry({width, height, thickness, block}, colors) {
  const mesh = new Mesh();
  const depth = thickness * 2;
  const postX = width / 2 + depth / 2;

  const bands = Math.max(1, Math.round(height / block));
  for (const side of [-1, 1]) {
    for (let i = 0; i < bands; i++) {
      const band = height / bands;
      const y = band * (i + 0.5);
      box(mesh, [side * postX, y, 0], [depth, band, depth], colors[i % colors.length]);
    }
  }

  const across = Math.max(1, Math.round((2 * postX + depth) / block));
  const cell = (2 * postX + depth) / across;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < across; i++) {
      const x = -postX - depth / 2 + cell * (i + 0.5);
      const y = height + block * (row + 0.5);
      box(mesh, [x, y, 0], [cell, block, depth], colors[(i + row) % colors.length]);
    }
  }
  return mesh;
}

// Each digit is 3 dots wide and 5 tall, a row at a time from the top, with 1
// where a dot goes.
const digits = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "001", "001", "001"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
};

// signSize is the width and height of a sign's board for a number of
// digits, each 3 dots wide with a dot between them, with room around them.
function signSize({digits, dot}) {
  const columns = Math.max(1, Math.round(digits)) * 4 - 1;
  return [columns * dot + 120, 5 * dot + 100];
}

// buildSign stands a framed board on a post, its face toward -Z, where
// racers come from.
function buildSign({digits, dot, post}) {
  const mesh = new Mesh();
  const [width, height] = signSize({digits, dot});
  const border = 24;
  const center = [0, post + height / 2, 0];

  box(mesh, center, [width, height, 16], board);
  box(mesh, add(center, [0, (height - border) / 2, 0]), [width, border, 24], frame);
  box(mesh, add(center, [0, -(height - border) / 2, 0]), [width, border, 24], frame);
  box(mesh, add(center, [(width - border) / 2, 0, 0]), [border, height, 24], frame);
  box(mesh, add(center, [-(width - border) / 2, 0, 0]), [border, height, 24], frame);
  box(mesh, [0, post / 2, 0], [32, post, 16], frame);
  return mesh;
}

// buildDigit lays a digit's dots as flat blocks, centered on the origin and
// standing out toward -Z from it, so the origin goes on a sign's face. Racers
// look along +Z, which puts +X on their left, so the columns run toward -X to
// read left to right.
function buildDigit({number, dot}, colors) {
  const mesh = new Mesh();
  const digit = String(Math.round(number));
  if (!digits[digit]) {
    throw new Error(`a digit is 0 to 9, not ${number}`);
  }
  digits[digit].forEach((row, r) => {
    [...row].forEach((on, c) => {
      if (on === "1") {
        box(mesh, [-(c - 1) * dot, (2 - r) * dot, -4], [dot + 1, dot + 1, 8], colors[0]);
      }
    });
  });
  return mesh;
}

const shapes = {ring: buildRing, gantry: buildGantry, sign: buildSign, digit: buildDigit};

function main() {
  const {out, shape = "ring", palette = "candy", ...overrides} = parseArgs(process.argv.slice(2));
  if (!shapes[shape]) {
    throw new Error(`unknown shape "${shape}"; shapes are ${Object.keys(shapes).join(", ")}`);
  }
  if (!palettes[palette]) {
    throw new Error(
      `unknown palette "${palette}"; palettes are ${Object.keys(palettes).join(", ")}`
    );
  }

  const parameters = {...defaults};
  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in defaults)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are shape, palette, ` +
          Object.keys(defaults).join(", ")
      );
    }
    parameters[name] = Number(value);
  }
  parameters.stripes = Math.max(2, Math.round(parameters.stripes));

  const base =
    shape === "ring"
      ? "race-gate"
      : shape === "digit"
        ? `race-digit-${Math.round(parameters.number)}`
        : `race-${shape}`;
  const filename =
    out ||
    (shape === "sign"
      ? `race-sign-${Math.round(parameters.digits)}.obj`
      : palette === "candy"
        ? `${base}.obj`
        : `${base}-${palette}.obj`);
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const mesh = shapes[shape](parameters, palettes[palette]);
  const meta = {
    generator: "bin/generate-gate.js",
    parameters: {...parameters, shape, palette},
  };
  const header = metaHeader(output, meta);
  fs.writeFileSync(output, mesh.toObj(header, "gate"));
  writeMeta(output, meta);

  // eslint-disable-next-line no-console
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
}

main();
