#!/usr/bin/env node
// generate-grass writes a clump of giant cartoon grass blades as an OBJ file,
// for Wingborn, where the ling sees grass at ant size, as a forest of blades
// many times taller than it (see games/wingborn/README.md). Each blade is a
// long, tapering ribbon, folded a little down its middle, that rises from
// the ground and curves out and over toward its pointed tip. The blades
// stand close together, leaning out from the middle of the clump, in a few
// greens, darker at the base, and some hold a dew drop.
//
// Its colors are vertex colors, with a lighter cartoon highlight on the side
// of each blade facing up, so it renders without a material color: the lit
// shaders add the material color to the vertex color, so leave it black.
// Each blade has both faces, since it is seen from either side.
//
// The clump stands on its origin, growing up +Y.
//
// Usage:
//   node bin/generate-grass.js                    grass.obj, from seed 0
//   node bin/generate-grass.js --seed 3           grass-3.obj
//   node bin/generate-grass.js --blades 3 --height 1200 --dew 0 --out short-grass.obj
//
// A seed always makes the same clump: it places the blades, and picks their
// heights, leans and colors around the parameters. Parameters:
//   --blades: how many blades. 7 by default.
//   --height: how tall the tallest blade reaches, along its curve. 2400 by
//     default; the others reach 55% to 100% of that.
//   --width: how wide a blade is at its base. 130 by default.
//   --spread: how far from the middle the blades' bases stand. 160 by default.
//   --lean: how far over the blades curve, as a part of their height. 0.35
//     by default.
//   --fold: how deep the fold down a blade's middle is, as a part of its
//     width. 0.15 by default.
//   --dew: how many blades hold a dew drop. 2 by default.
//   --colors: the blades' greens, each `r,g,b`, separated by `;`, such as
//     `--colors 0.42,0.65,0.25;0.55,0.78,0.32`. Three greens by default.
//
// Files are written to resources/obj unless --out says otherwise. The
// clump's colliders are printed and saved as a comment at the top of its
// file: an upright cylinder around the lower part of each blade, where it
// still stands up, for colliders in a scene (see collision in @scenic/scene).

const fs = require("fs");
const path = require("path");

const {Mesh, add, sub, scale, dot, cross, normalize, parseArgs} = require("./lib/mesh.js");

const STEPS = 12; // along a blade

// The direction of the cartoon highlight, up and a little to one side.
const HIGHLIGHT = normalize([0.3, 1, 0.4]);

const DEW = [0.8, 0.93, 0.99];
const GLINT = [1, 1, 1];

const defaults = {
  blades: 7,
  height: 2400,
  width: 130,
  spread: 160,
  lean: 0.35,
  fold: 0.15,
  dew: 2,
  colors: [
    [0.42, 0.66, 0.25],
    [0.5, 0.74, 0.3],
    [0.36, 0.6, 0.22],
  ],
};

// mulberry32 is a small seeded random number generator, so a seed always
// makes the same clump.
function mulberry32(seed) {
  let a = Math.imul((seed ^ 0x9e3779b9) >>> 0, 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// paint is color lightened, with a sharp edge, where normal faces the
// highlight, for a painted highlight rather than a gradient.
function paint(color, normal) {
  return dot(normal, HIGHLIGHT) > 0.55 ? color.map((v) => v + (1 - v) * 0.18) : color;
}

// curve is a point on a quadratic Bézier curve.
const curve = (p0, p1, p2, t) =>
  add(add(scale(p0, (1 - t) ** 2), scale(p1, 2 * (1 - t) * t)), scale(p2, t * t));

// ball adds a ball of color at center, radius wide.
function ball(mesh, center, radius, color) {
  const rings = 6;
  const sides = 10;
  const ring = Array.from({length: rings + 1}, (_, i) => {
    const latitude = Math.PI * (i / rings - 0.5);
    return Array.from({length: sides}, (_, s) => {
      const longitude = (s / sides) * 2 * Math.PI;
      const normal = [
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude),
      ];
      return mesh.vertex(add(center, scale(normal, radius)), normal, color);
    });
  });
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sides; s++) {
      const t = (s + 1) % sides;
      mesh.quad(ring[i][s], ring[i][t], ring[i + 1][t], ring[i + 1][s]);
    }
  }
}

// blade adds one blade standing at base, reaching height along its curve
// out over toward out, a direction along the ground, base width wide, in
// color, and returns where along it, picked with random, and which way its
// upper face points, for a dew drop.
function blade(mesh, base, out, height, width, lean, fold, color, random) {
  // The spine rises straight at first, then curves out to the tip, which
  // droops a little below where it would reach standing straight.
  const p0 = base;
  const p1 = add(base, [0, height * 0.65, 0]);
  const p2 = add(base, add([0, height * (0.9 - lean * 0.4), 0], scale(out, height * lean)));
  const spine = Array.from({length: STEPS + 1}, (_, i) => curve(p0, p1, p2, i / STEPS));

  // The blade's face looks along out, the way it bends, so across it is
  // sideways to out.
  const across = normalize(cross([0, 1, 0], out));
  const rows = spine.map((point, i) => {
    const t = i / STEPS;
    const tangent = normalize(sub(spine[Math.min(i + 1, STEPS)], spine[Math.max(i - 1, 0)]));
    const face = normalize(cross(across, tangent));
    // It tapers from its base to a point, swelling a little low down.
    const half = (width / 2) * Math.min(1, 1.2 * (1 - t) ** 0.8 + 0.15 * Math.sin(t * Math.PI));
    const shade = color.map((v) => v * (0.72 + 0.28 * Math.min(1, t * 1.6)));
    // The fold pushes its middle back from its edges.
    const rib = add(point, scale(face, -half * 2 * fold));
    return {
      t,
      face,
      points: [add(point, scale(across, -half)), rib, add(point, scale(across, half))],
      shade,
    };
  });

  // Both faces: the front, the way face points, and the back.
  for (const side of [1, -1]) {
    const ids = rows.map(({points, face, shade}) => {
      const edgeNormals = [
        normalize(add(scale(face, side), scale(across, -fold))),
        scale(face, side),
        normalize(add(scale(face, side), scale(across, fold))),
      ];
      return points.map((point, k) => {
        const normal = edgeNormals[k];
        return mesh.vertex(point, normal, paint(shade, normal));
      });
    });
    for (let i = 0; i < STEPS; i++) {
      for (let k = 0; k < 2; k++) {
        mesh.quad(ids[i][k], ids[i][k + 1], ids[i + 1][k + 1], ids[i + 1][k]);
      }
    }
  }

  const at = 0.45 + 0.2 * random();
  const row = rows[Math.round(at * STEPS)];
  return {point: row.points[1], face: row.face, half: width / 2};
}

// buildClump builds the clump: its blades at even turns around the middle,
// with a little wobble, each leaning out away from it, the tallest first.
function buildClump(p, random) {
  const mesh = new Mesh();
  const colliders = [];
  const holders = [];
  const turn = random() * 2 * Math.PI;
  for (let i = 0; i < p.blades; i++) {
    const angle = turn + (i / p.blades) * 2 * Math.PI + (random() - 0.5) * 0.8;
    const out = [Math.cos(angle), 0, Math.sin(angle)];
    const distance = p.spread * (0.3 + random() * 0.7);
    const base = scale(out, distance);
    const height = p.height * (i === 0 ? 1 : 0.55 + random() * 0.45);
    const width = p.width * (0.8 + random() * 0.4);
    const lean = p.lean * (0.6 + random() * 0.8);
    const color = p.colors[Math.floor(random() * p.colors.length)];
    holders.push(blade(mesh, base, out, height, width, lean, p.fold, color, random));
    colliders.push({
      name: `blade ${i + 1}`,
      shape: "cylinder",
      radius: width * 0.5,
      height: height * 0.35,
      position: add(base, [0, height * 0.175, 0]),
    });
  }

  // Dew drops sit on the upper face of the first blades, the tallest.
  for (const {point, face, half} of holders.slice(0, p.dew)) {
    const radius = half * (0.3 + random() * 0.15);
    const center = add(point, scale(face, radius * 0.9));
    ball(mesh, center, radius, DEW);
    ball(
      mesh,
      add(center, add(scale(face, radius * 0.55), [0, radius * 0.35, 0])),
      radius * 0.25,
      GLINT
    );
  }
  return {mesh, colliders};
}

function main() {
  const {seed: seedArg = 0, out, ...overrides} = parseArgs(process.argv.slice(2));
  const seed = Number(seedArg);
  if (!Number.isInteger(seed)) {
    throw new Error(`--seed must be a whole number, not "${seedArg}"`);
  }

  const parameters = {...defaults};
  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in defaults)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are seed, out, ${Object.keys(defaults).join(", ")}`
      );
    }
    parameters[name] =
      name === "colors"
        ? String(value)
            .split(";")
            .map((color) => color.split(",").map(Number))
        : Number(value);
  }
  for (const name of ["blades", "dew"]) {
    parameters[name] = Math.max(name === "blades" ? 1 : 0, Math.round(parameters[name]));
  }

  const filename = out || (seed ? `grass-${seed}.obj` : "grass.obj");
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const round = (_, v) => (typeof v === "number" ? Number(v.toFixed(3)) : v);
  const rounded = JSON.stringify(parameters, round);
  const {mesh, colliders} = buildClump(parameters, mulberry32(seed + 7919));
  const roundedColliders = JSON.stringify(colliders, round);
  fs.writeFileSync(
    output,
    mesh.toObj(
      [
        "Generated by bin/generate-grass.js",
        `Seed ${seed}`,
        `Parameters ${rounded}`,
        `Colliders ${roundedColliders}`,
      ],
      "grass"
    )
  );

  /* eslint-disable no-console */
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
  console.log(`parameters ${rounded}`);
  console.log(`colliders ${roundedColliders}`);
  /* eslint-enable no-console */
}

main();
