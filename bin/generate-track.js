#!/usr/bin/env node
// generate-track writes a bubbly race track as an OBJ file: a wide road
// looping back on itself, for racers to hover along, like a cartoon highway.
// The road is banded in two soft shades so racers can feel their speed, two
// dashed lane lines split it into three lanes, and puffy candy-striped curbs
// run along both edges. A checkered start line crosses it, with a grid of
// start boxes behind it, one per racer. Everything is colored with vertex
// colors, so it renders without a material color: leave the material color
// black.
//
// The road lies flat on the XZ plane, just above the ground, and runs through
// its control points in order and back to the first, along a smooth curve
// (a closed Catmull-Rom spline). The start line is at the first control point,
// facing along the road.
//
// The track is listed in a comment at the top of the file, so a scene can be
// built around it:
// - Track {"width", "length", "start", "gates", "points"}: the road's width
//   and length; where the start line is and which way it faces, as
//   {"position": [x, z], "heading": degrees}, with heading 0 facing +Z the way
//   node rotations do; the same for gates spread evenly along the road after
//   the start line, such as for a race (see
//   games/bubble-squadron/scripts/race.js); and points along the middle of the
//   road, every 100 or so, for scripts that need to know where the road is.
//
// Usage:
//   node bin/generate-track.js --seed 3                      highway-track-3.obj
//   node bin/generate-track.js --points "0,0;4000,2000;6000,-1000;1000,-3000"
//                                                            highway-track.obj
//   node bin/generate-track.js --seed 3 --width 1400 --gates 8 --out my-track.obj
//
// Parameters:
//   --seed: lays out a random loop of control points around the origin. A
//     seed always makes the same track.
//   --points: the control points instead, "x,z;x,z;...", at least 3.
//   --size: how far a random loop's control points are from the origin, on
//     average. 4500 by default.
//   --corners: how many control points a random loop has. 9 by default.
//   --width: the road's width. 1200 by default, three lanes wide enough for
//     racers side by side.
//   --gates: how many gates to list after the start line. 10 by default.

const fs = require("fs");
const path = require("path");

const {Mesh, parseArgs} = require("./lib/mesh.js");

const defaults = {size: 4500, corners: 9, width: 1200, gates: 10};

// Resolution and sizes, in scene units.
const STEP = 40; // between samples along the road
const ROAD_Y = 4; // the road's height over the ground, so the two don't flicker
const BAND = 400; // the length of each shade of the road's bands
const CURB_RADIUS = 34;
const CURB_SIDES = 12;
const STRIPE = 160; // the length of each of the curbs' stripes
const DASH = 240; // the length of a lane line's dashes, and of the gaps
const LINE = 22; // the width of lane lines and start boxes' lines

const colors = {
  road: [0.42, 0.43, 0.53],
  roadBand: [0.47, 0.48, 0.58],
  line: [0.98, 0.96, 0.86],
  curb: [
    [1, 0.38, 0.45],
    [1, 0.96, 0.9],
  ],
  checker: [
    [0.12, 0.12, 0.16],
    [0.97, 0.97, 0.97],
  ],
};

// mulberry32 is a small seeded random number generator, so a seed always
// makes the same track. The seed is scrambled first, since nearby seeds like
// 1, 2 and 3 otherwise start with similar numbers.
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

// randomLoop is corners control points around the origin, in order around
// it, each a random distance out, so the loop never crosses itself.
function randomLoop(random, {size, corners}) {
  return Array.from({length: corners}, (_, i) => {
    const angle = ((i + (random() - 0.5) * 0.5) / corners) * 2 * Math.PI;
    const distance = size * (0.65 + random() * 0.6);
    return [Math.sin(angle) * distance, Math.cos(angle) * distance];
  });
}

// centerline is the road's middle, sampled about every STEP along it: a
// closed Catmull-Rom spline through the control points, resampled evenly by
// length. Each sample is {position: [x, z], tangent: [x, z], distance}.
function centerline(points) {
  const n = points.length;
  const dense = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((k) => points[(i + k + n) % n]);
    for (let s = 0; s < 64; s++) {
      const t = s / 64;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push(
        [0, 1].map(
          (c) =>
            0.5 *
            (2 * p1[c] +
              (p2[c] - p0[c]) * t +
              (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
              (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3)
        )
      );
    }
  }

  // Lengths along the dense curve, around the loop and back to its start.
  const lengths = [0];
  for (let i = 1; i <= dense.length; i++) {
    const [a, b] = [dense[i - 1], dense[i % dense.length]];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = lengths[dense.length];
  const count = Math.round(length / STEP);

  const at = (distance) => {
    let i = 1;
    while (lengths[i] < distance) {
      i++;
    }
    const [a, b] = [dense[i - 1], dense[i % dense.length]];
    const t = (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };

  const positions = Array.from({length: count}, (_, i) => at((i * length) / count));
  const samples = positions.map((position, i) => {
    const [a, b] = [positions[(i - 1 + count) % count], positions[(i + 1) % count]];
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const d = Math.hypot(dx, dz) || 1;
    return {position, tangent: [dx / d, dz / d], distance: (i * length) / count};
  });
  return {samples, length};
}

// across is the direction across the road at a sample, to the left of a
// racer heading along it: a heading of 0 faces +Z, and turning left heads
// toward +X, so left is +X when heading along +Z.
const across = ({tangent: [tx, tz]}) => [tz, -tx];

// point is the spot offset across the road from a sample's middle, at
// height y.
const point = (sample, offset, y = ROAD_Y) => {
  const [ax, az] = across(sample);
  const [x, z] = sample.position;
  return [x + ax * offset, y, z + az * offset];
};

// strip adds a flat strip along the road, between offsets from its middle,
// for the samples from `from` to `to`, wrapping around the loop, colored by
// colorAt(sample).
function strip(mesh, samples, from, to, left, right, y, colorAt) {
  const n = samples.length;
  for (let i = from; i < to; i++) {
    const [s0, s1] = [samples[i % n], samples[(i + 1) % n]];
    const color = colorAt(s0);
    const v = [
      mesh.vertex(point(s0, left, y), [0, 1, 0], color),
      mesh.vertex(point(s1, left, y), [0, 1, 0], color),
      mesh.vertex(point(s1, right, y), [0, 1, 0], color),
      mesh.vertex(point(s0, right, y), [0, 1, 0], color),
    ];
    mesh.quad(...v);
  }
}

// curb sweeps a round, puffy rail along one edge of the road, striped in the
// curb colors, half sunk into the ground.
function curb(mesh, samples, offset) {
  const n = samples.length;
  const rings = samples.map((sample) => {
    const [ax, az] = across(sample);
    const center = point(sample, offset, CURB_RADIUS * 0.4);
    const color = colors.curb[Math.floor(sample.distance / STRIPE) % 2];
    return Array.from({length: CURB_SIDES}, (_, s) => {
      const angle = (s / CURB_SIDES) * 2 * Math.PI;
      const normal = [ax * Math.cos(angle), Math.sin(angle), az * Math.cos(angle)];
      return mesh.vertex(
        center.map((v, k) => v + normal[k] * CURB_RADIUS),
        normal,
        color
      );
    });
  });
  for (let i = 0; i < n; i++) {
    const [a, b] = [rings[i], rings[(i + 1) % n]];
    for (let s = 0; s < CURB_SIDES; s++) {
      const t = (s + 1) % CURB_SIDES;
      mesh.quad(a[s], a[t], b[t], b[s]);
    }
  }
}

// box adds a flat rectangle on the road, from `along` to `along + length`
// down the road from sample 0, and from left to right across it.
function box(mesh, samples, along, length, left, right, color) {
  const n = samples.length;
  const step = samples[1].distance - samples[0].distance;
  const from = Math.round(along / step);
  const to = Math.round((along + length) / step);
  strip(mesh, samples, n + from, n + to, left, right, ROAD_Y + 2, () => color);
}

function buildTrack(points, {width, gates}) {
  const mesh = new Mesh();
  const {samples, length} = centerline(points);
  const half = width / 2;
  const step = length / samples.length;

  // The road, in bands.
  strip(mesh, samples, 0, samples.length, half, -half, ROAD_Y, (s) =>
    Math.floor(s.distance / BAND) % 2 ? colors.roadBand : colors.road
  );

  // Lane lines a third of the way across, dashed, leaving the start line and
  // the start grid clear.
  const third = width / 6;
  for (const offset of [third, -third]) {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const dashed = Math.floor(s.distance / DASH) % 2 === 0;
      const nearStart = s.distance < 300 || s.distance > length - 1100;
      if (dashed && !nearStart) {
        strip(
          mesh,
          samples,
          i,
          i + 1,
          offset + LINE / 2,
          offset - LINE / 2,
          ROAD_Y + 1,
          () => colors.line
        );
      }
    }
  }

  curb(mesh, samples, half);
  curb(mesh, samples, -half);

  // The start line: two rows of checkers across the road.
  const squares = 12;
  const square = width / squares;
  for (let row = 0; row < 2; row++) {
    for (let c = 0; c < squares; c++) {
      const left = half - c * square;
      box(mesh, samples, row * square, square, left, left - square, colors.checker[(c + row) % 2]);
    }
  }

  // The start grid: a box in each lane, two rows deep, behind the line.
  const lane = width / 3;
  for (let row = 0; row < 2; row++) {
    for (let l = 0; l < 3; l++) {
      const left = half - l * lane - 90;
      const right = left - lane + 180;
      const along = -200 - row * 450 - 300;
      box(mesh, samples, along, LINE, left, right, colors.line);
      box(mesh, samples, along + 300 - LINE, LINE, left, right, colors.line);
      box(mesh, samples, along, 300, left, left - LINE, colors.line);
      box(mesh, samples, along, 300, right + LINE, right, colors.line);
    }
  }

  const heading = (s) => Math.round((Math.atan2(s.tangent[0], s.tangent[1]) * 180) / Math.PI);
  const place = (s) => ({position: s.position.map(Math.round), heading: heading(s)});
  const track = {
    width,
    length: Math.round(length),
    start: place(samples[0]),
    gates: Array.from({length: gates}, (_, i) =>
      place(samples[Math.round(((i + 1) * samples.length) / (gates + 1)) % samples.length])
    ),
    points: samples
      .filter((_, i) => i % Math.round(100 / step) === 0)
      .map((s) => s.position.map(Math.round)),
  };
  return {mesh, track};
}

function main() {
  const {out, seed: seedArg, points: pointsArg, ...overrides} = parseArgs(process.argv.slice(2));
  const parameters = {...defaults};
  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in defaults)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are seed, points, ` +
          Object.keys(defaults).join(", ")
      );
    }
    parameters[name] = Number(value);
  }

  const seed = seedArg != null ? Number(seedArg) : null;
  if (seed == null && !pointsArg) {
    throw new Error("give a track with --seed or --points");
  }
  const points = pointsArg
    ? String(pointsArg)
        .split(";")
        .map((p) => p.split(",").map(Number))
    : randomLoop(mulberry32(seed), parameters);
  if (points.length < 3) {
    throw new Error("a track needs at least 3 points");
  }

  const filename = out || (seed != null ? `highway-track-${seed}.obj` : "highway-track.obj");
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const {mesh, track} = buildTrack(points, parameters);
  const rounded = points.map((p) => p.map(Math.round));
  fs.writeFileSync(
    output,
    mesh.toObj(
      [
        "Generated by bin/generate-track.js",
        `Parameters ${JSON.stringify({...parameters, seed, points: rounded})}`,
        `Track ${JSON.stringify(track)}`,
      ],
      "track"
    )
  );

  /* eslint-disable no-console */
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
  console.log(`length ${track.length}, start ${JSON.stringify(track.start)}`);
  /* eslint-enable no-console */
}

main();
