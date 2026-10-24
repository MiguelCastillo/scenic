#!/usr/bin/env node
// generate-mushroom writes cartoon mushrooms as an OBJ file, for Wingborn,
// where the ling sees them at ant size, as towers to land on (see
// games/wingborn/README.md). Each has a thick stem and a round cap that can
// curl under at its rim, with spots on top and gills under it. The tallest
// stands on the origin, and any others stand around it, shorter and
// smaller.
//
// A style is a starting point, and every parameter below can change it:
// - single: one tall, puffy, red mushroom, a high perch.
// - cluster: a tall mushroom with two smaller ones around it, for short hops
//   between them.
// - pad: one low mushroom with a wide, flatter cap, an easy landing.
//
// Its colors are vertex colors, with a lighter cartoon highlight on top of
// each cap, so it renders without a material color: the lit shaders add the
// material color to the vertex color, so leave it black.
//
// The mushrooms grow up +Y.
//
// Usage:
//   node bin/generate-mushroom.js                       the cluster, mushroom-cluster.obj
//   node bin/generate-mushroom.js --style pad           the pad, mushroom-pad.obj
//   node bin/generate-mushroom.js --style pad --seed 3  a random pad, mushroom-pad-3.obj
//   node bin/generate-mushroom.js --puff 0.4 --cap-color 0.9,0.75,0.3 --out flat-yellow.obj
//
// Without a seed, a style is made exactly as it is. A seed makes it vary:
// it picks sizes near the style's, and how many spots there are. Either
// way, the seed, or 0, places the mushrooms and their spots, so a seed
// always makes the same mushrooms. Any parameter in the single style below
// can also be set by name, such as `--mushrooms 4`, `--puff 0.5` or
// `--stem-color 0.9,0.9,0.8`, and it wins over the style and the seed.
//
// Files are written to resources/obj unless --out says otherwise. The
// colliders are printed and saved as a comment at the top of the file: an
// upright cylinder up each stem, and one around each cap, named "cap 1" and
// so on, whose top is where the cap can be landed on, for colliders in a
// scene (see collision in @scenic/scene). A cap's also has its dome, how far
// its round top falls from its middle to its widest, for walking on it (see
// games/wingborn/scripts/fly.js).

const fs = require("fs");
const path = require("path");

const {Mesh, add, sub, scale, dot, cross, normalize, parseArgs} = require("./lib/mesh.js");

const SIDES = 32; // around a stem or a cap

// The direction of the cartoon highlight, up and a little to one side.
const HIGHLIGHT = normalize([0.4, 1, 0.3]);

// The styles' parameters, in scene units. The single one also says what
// each parameter means.
const single = {
  mushrooms: 1, // how many mushrooms: the tallest, and any others around it
  height: 600, // how tall the tallest stem is, to the bottom of its cap
  cap: 190, // how wide the tallest cap is, from its middle to its widest
  puff: 0.8, // how tall a cap's dome is, as a part of its width: low is flat
  curl: 1.15, // how far a cap's dome goes on past its widest, curling under:
  // 1 stops at its widest, and 1.3 curls far under
  stemWidth: 0.22, // how thick a stem is, as a part of its cap's width
  flare: 0.5, // how much wider a stem's foot is than its top
  lean: 0.08, // how far the smaller mushrooms' stems lean out, as a part of their height
  spots: 6, // how many spots on the tallest cap; smaller caps get fewer
  spotSize: 0.13, // how wide a spot is, as a part of its cap's width
  highlight: 0.22, // how much lighter the top of a cap is; 0 for none
  capColor: [0.85, 0.28, 0.18],
  stemColor: [0.94, 0.87, 0.7],
  gillColor: [0.92, 0.83, 0.64],
  spotColor: [1, 0.95, 0.86],
};
const styles = {
  single,
  cluster: {...single, mushrooms: 3, height: 500, cap: 195},
  pad: {...single, height: 180, cap: 290, puff: 0.5, curl: 1.08, stemWidth: 0.18, spots: 8},
};

// mulberry32 is a small seeded random number generator, so a seed always
// makes the same mushrooms.
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

// paint is color lightened by highlight, with a sharp edge, where normal
// faces the highlight, for a painted highlight rather than a gradient.
function paint(color, normal, highlight) {
  return dot(normal, HIGHLIGHT) > 0.8 ? color.map((v) => v + (1 - v) * highlight) : color;
}

// revolve spins a profile around an upright axis through base. profile is a
// list of {r, y, color} points, r out from the axis and y up it from base,
// listed so that the outside is on the left going along it, such as a cap
// from its top down over its rim, or a stem from its top down to its foot.
// The normals come from its slope, so it shades smoothly.
function revolve(mesh, base, profile, highlight) {
  const rings = profile.map((point, i) => {
    const prev = profile[Math.max(i - 1, 0)];
    const next = profile[Math.min(i + 1, profile.length - 1)];
    const [dr, dy] = [next.r - prev.r, next.y - prev.y];

    return Array.from({length: SIDES}, (_, s) => {
      const angle = (s / SIDES) * 2 * Math.PI;
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      const normal = normalize([-dy * cos, dr, -dy * sin]);
      return mesh.vertex(
        add(base, [point.r * cos, point.y, point.r * sin]),
        normal,
        paint(point.color, normal, highlight)
      );
    });
  });

  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < SIDES; s++) {
      const t = (s + 1) % SIDES;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// spot adds a spot on a cap whose dome is radius wide and height tall above
// top: a flattened dome size wide, in color, sitting on the cap at angle
// around it, tilt down from its top, in radians.
function spot(mesh, top, radius, height, angle, tilt, size, color) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const center = add(top, [
    radius * Math.sin(tilt) * cos,
    height * Math.cos(tilt),
    radius * Math.sin(tilt) * sin,
  ]);
  const up = normalize([
    (Math.sin(tilt) / radius) * cos,
    Math.cos(tilt) / height,
    (Math.sin(tilt) / radius) * sin,
  ]);
  const reference = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const across = normalize(cross(up, reference));
  const along = cross(up, across);

  const rings = 4;
  const sides = 12;
  const ring = Array.from({length: rings + 1}, (_, i) => {
    const latitude = (Math.PI / 2) * (i / rings);
    return Array.from({length: sides}, (_, s) => {
      const longitude = (s / sides) * 2 * Math.PI;
      const flat = add(scale(across, Math.cos(longitude)), scale(along, Math.sin(longitude)));
      const normal = normalize(
        add(scale(flat, Math.cos(latitude)), scale(up, Math.sin(latitude) * 3))
      );
      // It sinks a little into the cap, so its edge doesn't float over it.
      const point = add(
        center,
        add(
          scale(flat, Math.cos(latitude) * size),
          scale(up, Math.sin(latitude) * size * 0.25 - size * 0.1)
        )
      );
      return mesh.vertex(point, normal, color);
    });
  });
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sides; s++) {
      const t = (s + 1) % sides;
      mesh.quad(ring[i][s], ring[i][t], ring[i + 1][t], ring[i + 1][s]);
    }
  }
}

// mushroom adds one mushroom standing at base, height tall to the bottom of
// its cap, with a cap radius wide in capColor and spots spots, and returns
// its colliders, numbered number.
function mushroom(mesh, number, base, {height, radius, capColor, spots}, p, random) {
  const domeHeight = radius * p.puff;
  const stemRadius = radius * p.stemWidth;
  // A stem off the middle leans away from it.
  const out = Math.hypot(base[0], base[2]);
  const lean = height * p.lean;
  const top = add(
    base,
    out ? [(base[0] / out) * lean, height, (base[2] / out) * lean] : [0, height, 0]
  );

  // The stem, from its top down to its flared foot, bending with its lean.
  const steps = 8;
  const start = mesh.vertices.length;
  revolve(
    mesh,
    base,
    Array.from({length: steps + 1}, (_, i) => {
      const t = 1 - i / steps;
      return {r: stemRadius * (1 + p.flare * (1 - t) ** 3), y: height * t, color: p.stemColor};
    }),
    0
  );
  for (let i = start; i < mesh.vertices.length; i++) {
    const t = (mesh.vertices[i].position[1] - base[1]) / height;
    const bend = scale(sub(top, base), t * t);
    mesh.vertices[i].position = add(mesh.vertices[i].position, [bend[0], 0, bend[2]]);
  }

  // The cap: a dome from its top out past its widest, curling under at the
  // rim, then the gills under it, back in to the stem.
  const domeSteps = 14;
  const dome = Array.from({length: domeSteps + 1}, (_, i) => {
    const tilt = (i / domeSteps) * p.curl * (Math.PI / 2);
    return {r: radius * Math.sin(tilt), y: domeHeight * Math.cos(tilt), color: capColor};
  });
  const rim = dome[dome.length - 1];
  revolve(
    mesh,
    top,
    [
      ...dome,
      {r: rim.r * 0.97, y: rim.y - domeHeight * 0.04, color: p.gillColor},
      {r: radius * 0.6, y: rim.y * 0.6, color: p.gillColor},
      {r: stemRadius * 1.05, y: 0, color: p.gillColor},
    ],
    p.highlight
  );

  for (let i = 0; i < spots; i++) {
    const angle = (i / spots) * 2 * Math.PI + random() * 0.8;
    const tilt = 0.15 + random() * 0.85;
    const size = radius * p.spotSize * (0.8 + random() * 0.45);
    spot(mesh, top, radius, domeHeight, angle, tilt, size, p.spotColor);
  }

  return [
    {
      name: `stem ${number}`,
      shape: "cylinder",
      radius: stemRadius,
      height,
      position: add(base, [0, height / 2, 0]),
    },
    {
      name: `cap ${number}`,
      shape: "cylinder",
      radius,
      height: domeHeight - rim.y,
      dome: domeHeight,
      position: add(top, [0, (domeHeight + rim.y) / 2, 0]),
    },
  ];
}

// buildMushrooms builds the mushrooms: the tallest in the middle, and the
// others around it, shorter and smaller, at even turns with a little
// wobble, far enough out that their caps clear its stem.
function buildMushrooms(p, random) {
  const mesh = new Mesh();
  const colliders = mushroom(
    mesh,
    1,
    [0, 0, 0],
    {height: p.height, radius: p.cap, capColor: p.capColor, spots: p.spots},
    p,
    random
  );
  const others = p.mushrooms - 1;
  const turn = random() * 2 * Math.PI;
  for (let i = 0; i < others; i++) {
    const size = 0.45 + random() * 0.25;
    const radius = p.cap * size;
    const angle = turn + (i / others) * 2 * Math.PI + random() * 0.6;
    const distance = p.cap * 0.45 + radius * (1 + random() * 0.3);
    const tint = (random() - 0.5) * 0.08;
    colliders.push(
      ...mushroom(
        mesh,
        i + 2,
        [Math.cos(angle) * distance, 0, Math.sin(angle) * distance],
        {
          height: p.height * size * (0.75 + random() * 0.2),
          radius,
          capColor: p.capColor.map((v) => Math.max(0, Math.min(1, v + tint))),
          spots: Math.max(2, Math.round(p.spots * size)),
        },
        p,
        random
      )
    );
  }
  return {mesh, colliders};
}

function main() {
  const {seed: seedArg, style = "cluster", out, ...overrides} = parseArgs(process.argv.slice(2));
  if (!styles[style]) {
    throw new Error(`unknown style "${style}"; styles are ${Object.keys(styles).join(", ")}`);
  }
  const seed = seedArg != null ? Number(seedArg) : null;
  if (seed != null && !Number.isInteger(seed)) {
    throw new Error(`--seed must be a whole number, not "${seedArg}"`);
  }

  // A seed varies the style's sizes and spots.
  const parameters = {...styles[style]};
  if (seed != null) {
    const random = mulberry32(seed);
    const vary = (value, by) => value * (1 - by + random() * 2 * by);
    parameters.height = vary(parameters.height, 0.15);
    parameters.cap = vary(parameters.cap, 0.12);
    parameters.puff = vary(parameters.puff, 0.1);
    parameters.spots = Math.round(vary(parameters.spots, 0.3));
  }

  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in single)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are seed, style, out, ${Object.keys(single).join(", ")}`
      );
    }
    parameters[name] = Array.isArray(single[name])
      ? String(value).split(",").map(Number)
      : Number(value);
  }
  parameters.mushrooms = Math.max(1, Math.round(parameters.mushrooms));
  parameters.spots = Math.max(0, Math.round(parameters.spots));

  const filename =
    out || (seed != null ? `mushroom-${style}-${seed}.obj` : `mushroom-${style}.obj`);
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const round = (_, v) => (typeof v === "number" ? Number(v.toFixed(3)) : v);
  const rounded = JSON.stringify(parameters, round);
  // The layout gets its own random numbers, so overriding a parameter
  // doesn't reshuffle the mushrooms.
  const {mesh, colliders} = buildMushrooms(parameters, mulberry32((seed ?? 0) + 7919));
  const roundedColliders = JSON.stringify(colliders, round);
  fs.writeFileSync(
    output,
    mesh.toObj(
      [
        "Generated by bin/generate-mushroom.js",
        seed == null ? `Style ${style}` : `Seed ${seed}, style ${style}`,
        `Parameters ${rounded}`,
        `Colliders ${roundedColliders}`,
      ],
      "mushroom"
    )
  );

  /* eslint-disable no-console */
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
  console.log(seed == null ? `style ${style}` : `seed ${seed}, style ${style}`);
  console.log(`parameters ${rounded}`);
  console.log(`colliders ${roundedColliders}`);
  /* eslint-enable no-console */
}

main();
