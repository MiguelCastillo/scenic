#!/usr/bin/env node
// generate-rocket writes a bubbly cartoon rocket as an OBJ file. Each part is
// colored with vertex colors, so it renders without a material color: the lit
// shaders add the material color to the vertex color, so leave it black, or
// use it to tint the rocket.
//
// There are two styles, which any rocket's parts can mix:
// - classic: a round egg body with a dark nose dome, an antenna spike, a
//   riveted band, and swept fins.
// - slender: a tall body with a colored, pointed nose cone and a stripe under
//   it, ringed portholes, and a booster on the tip of each fin.
//
// The rocket's nose points along +Z, which is the front that the third-person
// camera follows, and its tail is at -Z.
//
// Usage:
//   node bin/generate-rocket.js                    the classic rocket, rocket.obj
//   node bin/generate-rocket.js --style slender    the slender rocket, rocket-slender.obj
//   node bin/generate-rocket.js --seed 42          a random rocket, rocket-42.obj
//   node bin/generate-rocket.js --random           a random rocket from a new seed
//   node bin/generate-rocket.js --seed 42 --style classic --fins 5 --out my-rocket.obj
//
// A seed always makes the same rocket, so a rocket you like can be made again
// from its seed. A seed picks a style unless --style names one, then varies
// that style's proportions a little and picks its colors. Any parameter below
// can also be set by name, such as `--fins 5`, `--fin-thickness 1.5` or
// `--body-color 1,0.4,0.6`, and it wins over what the seed picks. Files are
// written to resources/obj unless --out says otherwise. The parameters a
// rocket was made with are printed, and saved as a comment at the top of its
// file.

const fs = require("fs");
const path = require("path");

// The styles' parameters, in scene units. The classic one also says what each
// parameter means.
const styles = {
  classic: {
    radius: 30, // the body's radius at its widest
    nose: 65, // how far the nose reaches in front of the widest point
    noseRoundness: 0.55, // below 0.5 is pointier, above is bulbier
    tail: 55, // how far the egg curve would reach behind the widest point
    dome: 0.23, // how much of the nose the nose color covers, 0 to 1
    noseStripe: 0, // 1 for a stripe where the nose color starts
    band: -5, // where the band is, from the widest point
    bandRidge: 1, // 1 for a raised band around the body, 0 for none
    rivets: 12, // how many rivets go around the band; 0 for none
    spike: 32, // how long the antenna spike is; 0 for none
    portholes: 0, // how many portholes go down each side
    portholeSize: 12, // the radius of the first porthole; the rest are smaller
    fins: 3, // how many fins
    finSpan: 62, // how far the fin tips reach from the rocket's axis
    finSweep: 38, // how far the fin tips reach behind the body
    finRoot: 32, // how far up the body the fins attach, from the body's tail
    finThickness: 2.5, // how thick the fins are
    boosters: 0, // 1 for a booster on the tip of each fin
    boosterRadius: 12,
    boosterLength: 90,
    nozzle: 16, // the nozzle's radius where it flares out
    bodyColor: [0.9, 0.9, 0.92],
    noseColor: [0.08, 0.1, 0.16],
    finColor: [0.72, 0.74, 0.78],
    trimColor: [0.7, 0.72, 0.75], // the band, the rivets, and the nozzle
    stripeColor: [0.15, 0.2, 0.9],
    ringColor: [0.95, 0.35, 0.35], // the portholes' frames
    glassColor: [0.5, 0.88, 0.98],
  },
  slender: {
    radius: 22,
    nose: 100,
    noseRoundness: 0.42,
    tail: 75,
    dome: 0.36,
    noseStripe: 1,
    band: -5,
    bandRidge: 0,
    rivets: 0,
    spike: 0,
    portholes: 3,
    portholeSize: 10,
    fins: 3,
    finSpan: 70,
    finSweep: 6,
    finRoot: 42,
    finThickness: 2.5,
    boosters: 1,
    boosterRadius: 11,
    boosterLength: 85,
    nozzle: 13,
    bodyColor: [0.95, 0.95, 0.97],
    noseColor: [0.95, 0.3, 0.75],
    finColor: [0.95, 0.4, 0.75],
    trimColor: [0.95, 0.3, 0.75],
    stripeColor: [0.15, 0.2, 0.9],
    ringColor: [0.95, 0.35, 0.35],
    glassColor: [0.5, 0.88, 0.98],
  },
};

// randomParameters picks a rocket's parameters from random(), which returns
// numbers in [0, 1). Every rocket keeps its style's cartoon shape, so the
// proportions only vary a little around the style's, relative to the body's
// radius, and most of the variety is in size, details, and color. The ranges
// also keep the fins attached.
function randomParameters(random, styleName) {
  const between = (min, max) => min + (max - min) * random();
  const pick = (options) => options[Math.floor(random() * options.length)];

  const name = styleName || pick(Object.keys(styles));
  const style = styles[name];
  const radius = style.radius * between(0.85, 1.15);
  const r = (value) => (value * radius * between(0.9, 1.1)) / style.radius;

  // Bubbly colors: a light, soft body with a contrasting hue for the fins and
  // nose, and a third and fourth hue for the details.
  const hue = random();
  const mainHue = (hue + pick([0, 0.08, 0.5, 0.58, 0.92])) % 1;
  const detailHue = (mainHue + pick([0.33, 0.5, 0.66])) % 1;
  const whiteBody = random() < 0.4;
  const main = hsl(mainHue, between(0.6, 0.85), between(0.5, 0.62));

  const parameters = {
    ...style,
    radius,
    nose: r(style.nose),
    noseRoundness: style.noseRoundness * between(0.92, 1.08),
    tail: r(style.tail),
    dome: style.dome * between(0.8, 1.2),
    band: radius * between(-0.3, 0),
    spike: style.spike && r(style.spike),
    portholeSize: r(style.portholeSize),
    fins: pick([3, 3, 4]),
    finSpan: r(style.finSpan),
    finSweep: r(style.finSweep),
    finRoot: r(style.finRoot),
    finThickness: between(2.2, 3),
    boosterRadius: r(style.boosterRadius),
    boosterLength: r(style.boosterLength),
    nozzle: r(style.nozzle),
    bodyColor: whiteBody ? [0.93, 0.93, 0.95] : hsl(hue, between(0.45, 0.75), between(0.68, 0.8)),
    finColor: main,
    stripeColor: hsl(detailHue, 0.8, 0.5),
    ringColor: hsl((detailHue + 0.5) % 1, 0.75, 0.6),
    glassColor: hsl(between(0.5, 0.58), 0.85, between(0.75, 0.85)),
  };

  if (name === "classic") {
    Object.assign(parameters, {
      rivets: pick([8, 10, 12, 14, 16]),
      portholes: pick([0, 0, 1]),
      noseColor: hsl(hue, 0.4, between(0.07, 0.13)),
      trimColor: hsl(mainHue, 0.15, between(0.68, 0.8)),
    });
  } else {
    Object.assign(parameters, {
      portholes: pick([1, 2, 3, 3]),
      boosters: pick([0, 1, 1]),
      noseColor: main,
      trimColor: main,
    });
  }

  return {style: name, parameters};
}

// Resolution.
const SEGMENTS = 48; // around the rocket
const PROFILE_STEPS = 80; // along the body

const darkColors = {
  spike: [0.12, 0.12, 0.14],
  collar: [0.06, 0.07, 0.1],
  exhaust: [0.08, 0.08, 0.1],
};

// Mesh accumulates vertices, each with a normal and a color, and triangles
// that index them.
class Mesh {
  constructor() {
    this.vertices = [];
    this.triangles = [];
  }

  vertex(position, normal, color) {
    this.vertices.push({position, normal: normalize(normal), color});
    return this.vertices.length - 1;
  }

  // triangle adds a triangle facing outward: counterclockwise when seen from
  // the side its vertex normals point to, which is what back-face culling
  // keeps.
  triangle(a, b, c) {
    const [pa, pb, pc] = [a, b, c].map((i) => this.vertices[i].position);
    const facing = cross(sub(pb, pa), sub(pc, pa));
    const normal = add(
      add(this.vertices[a].normal, this.vertices[b].normal),
      this.vertices[c].normal
    );
    this.triangles.push(dot(facing, normal) >= 0 ? [a, b, c] : [a, c, b]);
  }

  quad(a, b, c, d) {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  // translate moves the vertices added since start by offset.
  translate(start, offset) {
    for (let i = start; i < this.vertices.length; i++) {
      this.vertices[i].position = add(this.vertices[i].position, offset);
    }
  }

  toObj(header) {
    const lines = [...header.map((line) => `# ${line}`), "g rocket"];
    for (const {position, color} of this.vertices) {
      lines.push(`v ${[...position, ...color].map(fmt).join(" ")}`);
    }
    for (const {normal} of this.vertices) {
      lines.push(`vn ${normal.map(fmt).join(" ")}`);
    }
    for (const triangle of this.triangles) {
      lines.push(`f ${triangle.map((i) => `${i + 1}//${i + 1}`).join(" ")}`);
    }
    return lines.join("\n") + "\n";
  }
}

const fmt = (n) => (Math.abs(n) < 1e-6 ? "0" : n.toFixed(4).replace(/\.?0+$/, ""));
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a) => {
  const length = Math.hypot(...a);
  return length ? scale(a, 1 / length) : a;
};

// hsl converts a hue, saturation, and lightness, each 0 to 1, to RGB.
function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}

// mulberry32 is a small seeded random number generator, so a seed always
// makes the same rocket. The seed is scrambled first, since nearby seeds like
// 1, 2 and 3 otherwise start with similar numbers and make similar rockets.
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

// lathe spins a profile around the Z axis. profile is a list of
// {r, z, color} points along the axis, and the normals come from the
// profile's slope so the surface shades smoothly.
function lathe(mesh, profile, segments = SEGMENTS) {
  const rings = profile.map((point, i) => {
    const prev = profile[Math.max(i - 1, 0)];
    const next = profile[Math.min(i + 1, profile.length - 1)];

    // The profile's normal is its tangent turned away from the axis, which
    // works for profiles going either way along Z.
    const [dr, dz] = [next.r - prev.r, next.z - prev.z];
    const flip = dz < 0 ? -1 : 1;
    const [nr, nz] = point.normal || [dz * flip, -dr * flip];

    return Array.from({length: segments}, (_, s) => {
      const angle = (s / segments) * 2 * Math.PI;
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      return mesh.vertex(
        [point.r * cos, point.r * sin, point.z],
        [nr * cos, nr * sin, nz],
        point.color
      );
    });
  });

  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < segments; s++) {
      const t = (s + 1) % segments;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// disk closes the end of a lathe at z with a flat cap facing along normalZ.
function disk(mesh, r, z, normalZ, color, segments = SEGMENTS) {
  const center = mesh.vertex([0, 0, z], [0, 0, normalZ], color);
  const ring = Array.from({length: segments}, (_, s) => {
    const angle = (s / segments) * 2 * Math.PI;
    return mesh.vertex([r * Math.cos(angle), r * Math.sin(angle), z], [0, 0, normalZ], color);
  });
  for (let s = 0; s < segments; s++) {
    mesh.triangle(center, ring[s], ring[(s + 1) % segments]);
  }
}

function sphere(mesh, center, radius, color, segments = 10) {
  const profile = Array.from({length: segments + 1}, (_, i) => {
    const angle = Math.PI * (i / segments - 0.5);
    return {
      r: radius * Math.cos(angle),
      z: radius * Math.sin(angle),
      normal: [Math.cos(angle), Math.sin(angle)],
      color,
    };
  });

  const start = mesh.vertices.length;
  lathe(mesh, profile, segments);
  mesh.translate(start, center);
}

// bezier is a point on a quadratic Bézier curve of [radius, z] points.
const bezier = (p0, p1, p2, t) =>
  add(add(scale(p0, (1 - t) ** 2), scale(p1, 2 * (1 - t) * t)), scale(p2, t * t));

// eggRadius is the radius at z of an egg that is radius wide at z = 0, reaches
// nose in front, with roundness saying how bulby the nose is, and reaches tail
// behind.
function eggRadius(z, {radius, nose, noseRoundness, tail}) {
  return z >= 0
    ? radius * Math.pow(Math.max(1 - (z / nose) ** 2, 0), noseRoundness)
    : radius * Math.sqrt(Math.max(1 - (z / tail) ** 2, 0));
}

// eggProfile is the lathe profile of an egg from z = from to its nose, with
// ridges as small bumps, colored by color(z).
function eggProfile(egg, from, ridges, color) {
  const radius = (z) =>
    eggRadius(z, egg) +
    ridges.reduce((sum, ridge) => sum + 0.8 * Math.exp(-(((z - ridge) / 1.2) ** 2)), 0);

  // Steps are spread evenly by angle around the egg rather than by z, so the
  // rounded nose gets as many steps as the flatter sides.
  const profile = [];
  for (let i = 0; i <= PROFILE_STEPS; i++) {
    const z = from + ((egg.nose - from) * (1 - Math.cos((i / PROFILE_STEPS) * Math.PI))) / 2;
    profile.push({r: radius(z), z, color: color(z)});
  }
  // The very tip closes on the axis, pointing forward.
  profile[profile.length - 1] = {r: 0, z: egg.nose, normal: [0, 1], color: color(egg.nose)};
  return {profile, radius};
}

function buildRocket(p) {
  const mesh = new Mesh();

  // The body is cut off behind its widest point, where the engine attaches.
  const bodyTail = -p.tail * 0.82;
  const noseStart = p.nose * (1 - p.dome);

  const ridges = [p.bandRidge && p.band, p.noseStripe && noseStart - 1.5].filter(
    (z) => z !== 0 && z != null
  );
  const {profile, radius: bodyRadius} = eggProfile(p, bodyTail, ridges, (z) => {
    if (z > noseStart) {
      return p.noseColor;
    }
    if (p.noseStripe && z > noseStart - 3) {
      return p.stripeColor;
    }
    if (p.bandRidge && Math.abs(z - p.band) < 1.5) {
      return p.trimColor;
    }
    return p.bodyColor;
  });
  lathe(mesh, profile);

  // Rivets around the band.
  for (let i = 0; i < p.rivets; i++) {
    const angle = (i / p.rivets) * 2 * Math.PI;
    const r = bodyRadius(p.band);
    sphere(mesh, [r * Math.cos(angle), r * Math.sin(angle), p.band], 1.3, p.trimColor);
  }

  // The antenna spike.
  if (p.spike > 0) {
    lathe(
      mesh,
      [
        {r: 3, z: p.nose - 4, color: darkColors.spike},
        {r: 2, z: p.nose + 4, color: darkColors.spike},
        {r: 0, z: p.nose + p.spike, color: darkColors.spike},
      ],
      16
    );
  }

  // Portholes go down both sides, halfway between the fins: a big one under
  // the nose and smaller ones below it.
  const sides = [Math.PI / 2 + Math.PI / p.fins, Math.PI / 2 - Math.PI / p.fins];
  let z = noseStart - (p.noseStripe ? 4 : 0) - p.portholeSize * 1.4;
  for (let i = 0; i < p.portholes; i++) {
    const size = i === 0 ? p.portholeSize : p.portholeSize * 0.65;
    if (i > 0) {
      z -= size * 1.2;
    }
    for (const angle of sides) {
      buildPorthole(mesh, p, bodyRadius, angle, z, size);
    }
    z -= size * 1.6;
  }

  buildEngine(mesh, p, bodyTail, bodyRadius(bodyTail), p.nozzle);

  // One fin points straight up, like a tail, and the rest spread evenly
  // around. A booster sits on each fin's tip.
  for (let i = 0; i < p.fins; i++) {
    const angle = Math.PI / 2 + (i / p.fins) * 2 * Math.PI;
    buildFin(mesh, p, bodyRadius, bodyTail, angle);
    if (p.boosters) {
      buildBooster(mesh, p, angle, bodyTail - p.finSweep);
    }
  }

  return mesh;
}

// buildEngine adds the engine under a body cut off at tail: a dark collar,
// then the flared nozzle, then the exhaust pipe that a flame can come out of.
function buildEngine(mesh, p, tail, tailRadius, nozzle) {
  const collar = Math.max(tailRadius - 1.5, nozzle * 0.7);
  const s = nozzle / 16; // the engine's lengths scale with its size
  lathe(mesh, [
    {r: tailRadius, z: tail + 1, normal: [1, 0], color: darkColors.collar},
    {r: collar, z: tail - 5 * s, normal: [1, 0], color: darkColors.collar},
  ]);
  disk(mesh, collar, tail - 5 * s, -1, darkColors.collar);
  lathe(mesh, [
    {r: nozzle * 0.62, z: tail - 5 * s, color: p.trimColor},
    {r: nozzle * 0.8, z: tail - 9 * s, color: p.trimColor},
    {r: nozzle, z: tail - 13 * s, color: p.trimColor},
  ]);
  disk(mesh, nozzle, tail - 13 * s, -1, p.trimColor);
  lathe(mesh, [
    {r: nozzle * 0.5, z: tail - 13 * s, normal: [1, 0], color: darkColors.exhaust},
    {r: nozzle * 0.5, z: tail - 21 * s, normal: [1, 0], color: darkColors.exhaust},
  ]);
  disk(mesh, nozzle * 0.5, tail - 21 * s, -1, darkColors.exhaust);
}

// buildPorthole adds a round window on the body at angle and z: glass inside
// a frame, both lying on the body's curve just above its surface.
function buildPorthole(mesh, p, bodyRadius, angle, z, size) {
  const steps = 32;

  // onBody is the point on the body, lifted by lift, at offset [across,
  // along] from the porthole's center, along with the body's normal there.
  const onBody = ([across, along], lift) => {
    const zz = z + along;
    const r = bodyRadius(zz);
    const a = angle + across / r;
    const slope = (bodyRadius(zz + 0.5) - bodyRadius(zz - 0.5)) / 1;
    const [cos, sin] = [Math.cos(a), Math.sin(a)];
    return {
      position: [(r + lift) * cos, (r + lift) * sin, zz],
      normal: [cos, sin, -slope],
    };
  };
  const ring = (radius, lift, color) =>
    Array.from({length: steps}, (_, s) => {
      const t = (s / steps) * 2 * Math.PI;
      const {position, normal} = onBody([radius * Math.cos(t), radius * Math.sin(t)], lift);
      return mesh.vertex(position, normal, color);
    });

  // The frame is a flat ring, and the glass a disk sitting just above it.
  const outer = ring(size, 0.4, p.ringColor);
  const inner = ring(size * 0.62, 0.4, p.ringColor);
  for (let s = 0; s < steps; s++) {
    const t = (s + 1) % steps;
    mesh.quad(outer[s], outer[t], inner[t], inner[s]);
  }

  const center = onBody([0, 0], 0.5);
  const middle = mesh.vertex(center.position, center.normal, p.glassColor);
  const glass = ring(size * 0.62, 0.5, p.glassColor);
  for (let s = 0; s < steps; s++) {
    mesh.triangle(middle, glass[s], glass[(s + 1) % steps]);
  }
}

// buildBooster adds a small rocket on the tip of the fin at angle, with its
// tail at z.
function buildBooster(mesh, p, angle, z) {
  const egg = {
    radius: p.boosterRadius,
    nose: p.boosterLength * 0.6,
    noseRoundness: p.noseRoundness,
    tail: p.boosterLength * 0.4 * 1.25,
  };
  const from = -p.boosterLength * 0.4;
  const noseStart = egg.nose * (1 - p.dome * 1.2);
  const ridges = p.noseStripe ? [noseStart - 1.2] : [];
  const {profile, radius} = eggProfile(egg, from, ridges, (zz) => {
    if (zz > noseStart) {
      return p.noseColor;
    }
    if (p.noseStripe && zz > noseStart - 2.5) {
      return p.stripeColor;
    }
    return p.bodyColor;
  });

  const start = mesh.vertices.length;
  lathe(mesh, profile, 32);
  buildEngine(mesh, p, from, radius(from), p.boosterRadius * 0.7);
  mesh.translate(start, [p.finSpan * Math.cos(angle), p.finSpan * Math.sin(angle), z - from]);
}

// buildFin adds a swept fin at angle around the body. Seen from the side it
// is a crescent between an outer edge, which leaves the body ahead of the
// engine and sweeps out and back to the tip, and an inner edge, which curves
// from the tip back into the bottom of the body. Both edges start a little
// inside the body, so the fin always looks attached.
function buildFin(mesh, p, bodyRadius, bodyTail, angle) {
  const outward = [Math.cos(angle), Math.sin(angle), 0];
  const across = [-Math.sin(angle), Math.cos(angle), 0];
  const inset = p.radius * 0.1;
  const tip = [p.finSpan, bodyTail - p.finSweep];

  // The fin's root runs from finRoot up the body down to near its tail. It
  // stops behind the widest point, where the body starts curving in.
  const outerRoot = Math.min(bodyTail + p.finRoot, -p.radius * 0.1);
  const innerRoot = bodyTail + p.radius * 0.2;
  const outer = (t) =>
    bezier(
      [bodyRadius(outerRoot) - inset, outerRoot],
      [p.finSpan * 0.9, (outerRoot + bodyTail) / 2],
      tip,
      t
    );
  const inner = (t) =>
    bezier(
      [bodyRadius(innerRoot) - inset, innerRoot],
      [(bodyRadius(innerRoot) + p.finSpan) / 2, bodyTail - p.finSweep * 0.25],
      tip,
      t
    );
  const at = ([r, z], side) =>
    add(add(scale(outward, r), [0, 0, z]), scale(across, (side * p.finThickness) / 2));

  const steps = 24;
  const edges = Array.from({length: steps + 1}, (_, i) => [outer(i / steps), inner(i / steps)]);

  // Both faces of the fin.
  for (const side of [1, -1]) {
    const normal = scale(across, side);
    const rows = edges.map(([o, n]) => [
      mesh.vertex(at(o, side), normal, p.finColor),
      mesh.vertex(at(n, side), normal, p.finColor),
    ]);
    for (let i = 0; i < steps; i++) {
      mesh.quad(rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]);
    }
  }

  // The thin edges around it, each facing away from the other edge.
  for (const [edge, other] of [
    [0, 1],
    [1, 0],
  ]) {
    for (let i = 0; i < steps; i++) {
      const [a, b] = [edges[i][edge], edges[i + 1][edge]];
      const away = sub(a, edges[i][other]);
      const normal = normalize(add(scale(outward, away[0]), [0, 0, away[1]]));
      mesh.quad(
        mesh.vertex(at(a, 1), normal, p.finColor),
        mesh.vertex(at(b, 1), normal, p.finColor),
        mesh.vertex(at(b, -1), normal, p.finColor),
        mesh.vertex(at(a, -1), normal, p.finColor)
      );
    }
  }
}

// parseArgs reads `--name value` pairs and `--flag`s. Names can be written
// kebab-case, such as --fin-span, for the camelCase parameters.
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) {
      throw new Error(`unexpected argument "${argv[i]}"`);
    }
    const name = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const hasValue = i + 1 < argv.length && !argv[i + 1].startsWith("--");
    args[name] = hasValue ? argv[++i] : true;
  }
  return args;
}

function main() {
  const {
    seed: seedArg,
    random: randomSeed,
    style: styleArg,
    out,
    ...overrides
  } = parseArgs(process.argv.slice(2));

  if (styleArg && !styles[styleArg]) {
    throw new Error(`unknown style "${styleArg}"; styles are ${Object.keys(styles).join(", ")}`);
  }

  const seed = randomSeed
    ? Math.floor(Math.random() * 1e6)
    : seedArg != null
    ? Number(seedArg)
    : null;
  if (seed != null && !Number.isInteger(seed)) {
    throw new Error(`--seed must be a whole number, not "${seedArg}"`);
  }

  const {style, parameters} =
    seed == null
      ? {style: styleArg || "classic", parameters: {...styles[styleArg || "classic"]}}
      : randomParameters(mulberry32(seed), styleArg);

  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in styles.classic)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are ${Object.keys(styles.classic).join(", ")}`
      );
    }
    parameters[name] = Array.isArray(styles.classic[name])
      ? String(value).split(",").map(Number)
      : Number(value);
  }
  for (const name of ["fins", "rivets", "portholes"]) {
    parameters[name] = Math.round(parameters[name]);
  }

  const defaultName =
    seed != null
      ? `rocket-${seed}.obj`
      : style === "classic"
      ? "rocket.obj"
      : `rocket-${style}.obj`;
  const filename = out || defaultName;
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const rounded = JSON.stringify(parameters, (_, v) =>
    typeof v === "number" ? Number(v.toFixed(3)) : v
  );
  const mesh = buildRocket(parameters);
  fs.writeFileSync(
    output,
    mesh.toObj([
      "Generated by bin/generate-rocket.js",
      seed == null ? `Style ${style}` : `Seed ${seed}, style ${style}`,
      `Parameters ${rounded}`,
    ])
  );

  /* eslint-disable no-console */
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
  console.log(seed == null ? `style ${style}` : `seed ${seed}, style ${style}`);
  console.log(`parameters ${rounded}`);
  /* eslint-enable no-console */
}

main();
