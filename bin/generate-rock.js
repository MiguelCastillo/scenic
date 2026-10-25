#!/usr/bin/env node
// generate-rock writes a cartoon mossy rock as an OBJ file, for Wingborn,
// where the ling sees rocks at ant size, as boulders to land on (see
// games/wingborn/README.md). It is an uneven stone, lumpy, chipped flat in
// places and leaning, half sunk into the ground, grey with a darker underside, under a soft cap of moss, which drips
// down its sides in tongues.
//
// A style is a starting point, and every parameter below can change it:
// - boulder: a round rock, about as tall as it is wide.
// - slab: a low, wide rock, an easy landing.
// - standing: a tall stone, standing up.
//
// Its colors are vertex colors, each triangle one color, so the moss's edge
// is sharp, with a lighter cartoon highlight on top of the moss, so it
// renders without a material color: the lit shaders add the material color to
// the vertex color, so leave it black. It has texture coordinates too, for a
// texture that tints it, such as stone.png from bin/generate-texture.js (see
// textures on a static mesh in the README).
//
// The rock sits on its origin, growing up +Y, and reaches a little below the
// ground, so it sits in the ground rather than on it.
//
// Usage:
//   node bin/generate-rock.js                       the boulder, rock-boulder.obj
//   node bin/generate-rock.js --style slab          the slab, rock-slab.obj
//   node bin/generate-rock.js --style slab --seed 3 a random slab, rock-slab-3.obj
//   node bin/generate-rock.js --moss 0.2 --out bare-rock.obj
//
// Without a seed, a style is made exactly as it is. A seed makes it vary: it
// picks sizes near the style's, and lumps it and drips its moss differently.
// Any parameter in the boulder style below can also be set by name, such as
// `--height 300` or `--moss-color 0.5,0.7,0.3`, and it wins over the style
// and the seed.
//
// Files are written to resources/obj unless --out says otherwise. Its
// collider is printed and saved as a comment at the top of the file: an
// upright cylinder around it, named "top", that can be landed on, with its
// dome, how far its round top falls from its middle to its edge, for
// colliders in a scene (see collision in @scenic/scene, and perches in
// games/wingborn/scripts/fly.js).

const fs = require("fs");
const path = require("path");

const {Mesh, cross, dot, normalize, parseArgs, sub} = require("./lib/mesh.js");

const SIDES = 72; // around the rock
const RINGS = 36; // from its foot to its top
// How many times its texture wraps around it.
const TEXTURE_WRAPS = 6;

// The direction of the cartoon highlight, up and a little to one side.
const HIGHLIGHT = normalize([0.4, 1, 0.3]);

// The styles' parameters, in scene units. The boulder one also says what
// each parameter means.
const boulder = {
  width: 260, // how far it reaches out along X, from its middle
  depth: 230, // how far it reaches out along Z, from its middle
  height: 240, // how tall it stands above the ground
  lumps: 0.22, // how lumpy it is, as a part of its size
  blocky: 0.4, // how square it is, from 0, round, to 1, a box
  facets: 9, // how many flat faces are chipped into it
  cut: 0.4, // how deep its facets cut, as a part of its size
  lean: 0.15, // how far its top leans to one side, as a part of its height
  moss: 0.45, // how far down its sides the moss reaches, 0 to 1: 0 is none
  drips: 6, // how many tongues of moss drip down its sides
  dripLength: 0.3, // how far the tongues drip below the moss's edge, 0 to 1
  highlight: 0.2, // how much lighter the top of the moss is; 0 for none
  stoneColor: [0.56, 0.57, 0.52],
  shadowColor: [0.4, 0.41, 0.38],
  mossColor: [0.3, 0.5, 0.18],
};
const styles = {
  boulder,
  slab: {
    ...boulder,
    width: 420,
    depth: 340,
    height: 130,
    lumps: 0.12,
    facets: 5,
    lean: 0.1,
    moss: 0.6,
  },
  standing: {
    ...boulder,
    width: 170,
    depth: 160,
    height: 420,
    lumps: 0.14,
    cut: 0.35,
    lean: 0.2,
    moss: 0.3,
  },
};

// mulberry32 is a small seeded random number generator, so a seed always
// makes the same rock.
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

// lumpsFrom is a smooth, lumpy function of a direction, from -1 to 1: a few
// waves around and up the rock, at turns and phases random picks.
function lumpsFrom(random) {
  const waves = Array.from({length: 7}, () => ({
    around: 1 + Math.floor(random() * 3),
    up: 1 + Math.floor(random() * 2),
    phase: random() * 2 * Math.PI,
    weight: 0.5 + random() * 0.5,
  }));
  const total = waves.reduce((sum, {weight}) => sum + weight, 0);
  return (angle, latitude) =>
    waves.reduce(
      (sum, {around, up, phase, weight}) =>
        sum + weight * Math.sin(angle * around + phase) * Math.cos(latitude * up + phase),
      0
    ) / total;
}

// buildRock builds the rock: rings of points around it from a little below
// the ground up to its top, on a squashed ball, pushed in and out by its
// lumps, chipped flat by its facets, and leaning to one side, so it's uneven
// the way rocks are. Points high enough up are moss, down to where the moss's
// edge wavers and drips, and the rest is stone, darker underneath.
function buildRock(p, random) {
  const mesh = new Mesh();
  const lumps = lumpsFrom(random);
  const dripPhase = random() * 2 * Math.PI;
  const edgePhase = random() * 2 * Math.PI;

  // The facets are flat cuts across the ball, each a plane facing out
  // somewhere around its sides, or tipped up toward its top, cutting off
  // what is past it, and the first one flattens its top.
  const facets = Array.from({length: p.facets}, (_, i) => {
    const angle = random() * 2 * Math.PI;
    const latitude = i === 0 ? Math.PI / 2 - random() * 0.3 : random() * 0.9;
    return {
      normal: [
        Math.cos(latitude) * Math.cos(angle),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(angle),
      ],
      offset: 1 - p.cut * (i === 0 ? 0.3 : 0.5 + random() * 0.5),
    };
  });
  // It leans toward one side, its top shifted by lean, as a part of its
  // height, and bulges out more on that side than the other.
  const leanAngle = random() * 2 * Math.PI;
  const leanTo = [Math.cos(leanAngle), 0, Math.sin(leanAngle)];
  const radii = [p.width, p.height, p.depth];

  // The point on the rock in direction from its middle.
  const pointAt = (direction) => {
    // The lumps fade out toward its top, where every way around meets, so
    // they don't pinch it into creases there.
    const fade = Math.sqrt(1 - Math.max(0, direction[1]) ** 2);
    const bulge =
      1 + p.lumps * fade * lumps(Math.atan2(direction[2], direction[0]), Math.asin(direction[1]));
    // A blocky rock is a ball pushed out toward a box: the higher the power,
    // the squarer.
    const power = 2 + 4 * p.blocky;
    const boxed = direction.reduce((sum, v) => sum + Math.abs(v) ** power, 0) ** (-1 / power);
    let point = direction.map((v) => v * bulge * boxed);
    for (const {normal, offset} of facets) {
      const reach = dot(point, normal);
      if (reach > offset) {
        point = point.map((v) => (v * offset) / reach);
      }
    }
    const side = dot(point, leanTo);
    const up = Math.max(0, point[1]);
    return point.map(
      (v, axis) =>
        v * radii[axis] * (axis === 1 ? 1 : 1 + 0.5 * p.lean * side) +
        leanTo[axis] * p.lean * p.height * up
    );
  };

  // The rock goes from a little below the ground, so its foot is hidden, to
  // its top.
  const bottom = Math.asin(-0.25);
  const grid = Array.from({length: RINGS + 1}, (_, i) => {
    const latitude = bottom + ((Math.PI / 2 - bottom) * i) / (RINGS + 1);
    return Array.from({length: SIDES}, (_, s) => {
      const angle = (s / SIDES) * 2 * Math.PI;
      const direction = [
        Math.cos(latitude) * Math.cos(angle),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(angle),
      ];
      return {angle, direction, position: pointAt(direction)};
    });
  });
  const top = pointAt([0, 1, 0]);
  const height = Math.max(top[1], ...grid.flat().map(({position}) => position[1]));

  // Its normals come from its shape, since the facets and lean bend it away
  // from a ball: each point's is the sum of the faces' around it, bigger
  // faces counting for more, so the many thin faces near the top, where the
  // rings close in, don't make it streaky.
  const sums = grid.map((ring) => ring.map(() => [0, 0, 0]));
  const topSum = [0, 0, 0];
  const addFace = (corners) => {
    const [pa, pb, pc] = corners.map(([i, s]) => (i > RINGS ? top : grid[i][s % SIDES].position));
    const face = cross(sub(pb, pa), sub(pc, pa));
    for (const [i, s] of corners) {
      const sum = i > RINGS ? topSum : sums[i][s % SIDES];
      face.forEach((v, axis) => (sum[axis] += v));
    }
  };
  for (let i = 0; i <= RINGS; i++) {
    for (let s = 0; s < SIDES; s++) {
      if (i < RINGS) {
        addFace([
          [i, s],
          [i + 1, s + 1],
          [i, s + 1],
        ]);
        addFace([
          [i, s],
          [i + 1, s],
          [i + 1, s + 1],
        ]);
      } else {
        addFace([
          [i, s],
          [i + 1, 0],
          [i, s + 1],
        ]);
      }
    }
  }
  const points = grid.map((ring, i) =>
    ring.map(({angle, direction, position}, s) => {
      let normal = normalize(sums[i][s]);
      if (dot(normal, direction) < 0) {
        normal = normal.map((v) => -v);
      }

      // How high up the rock this is, 0 at the ground and 1 at the top, and
      // how far down the moss reaches here: its edge wavers, and drips
      // further down in tongues.
      const up = Math.max(0, position[1] / height);
      const waver = 0.06 * Math.sin(angle * 3 + edgePhase);
      const drip = p.dripLength * Math.max(0, Math.sin(angle * p.drips + dripPhase)) ** 4;
      const mossy = p.moss > 0 && up > 1 - p.moss - waver - drip;
      return {position, normal, mossy, lit: dot(normal, HIGHLIGHT) > 0.8};
    })
  );

  // Its texture is laid on each triangle straight along the axis it faces
  // most, from above, the side or the front, so it is never stretched, and
  // it repeats every `repeat` units, TEXTURE_WRAPS times around the rock (see
  // textures on a static mesh in the README).
  const repeat = (2 * Math.PI * ((p.width + p.depth) / 2)) / TEXTURE_WRAPS;
  const uvOf = ([x, y, z], [nx, ny, nz]) => {
    const [ax, ay, az] = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    return [u / repeat, v / repeat];
  };

  // Each triangle has its own corners, all one color, so the moss's edge is
  // sharp, running along the triangles' edges, rather than blurring across
  // them. A triangle is moss when most of its corners are, lighter when most
  // of them face the highlight, and stone darker underneath when it faces
  // down.
  const facet = (corners) => {
    const normal = normalize(
      corners.reduce((sum, {normal}) => sum.map((v, i) => v + normal[i]), [0, 0, 0])
    );
    const mossy = corners.filter(({mossy}) => mossy).length >= 2;
    const lit = corners.filter(({lit}) => lit).length >= 2;
    const color = mossy
      ? lit
        ? lighten(p.mossColor, p.highlight)
        : p.mossColor
      : normal[1] < -0.1
        ? p.shadowColor
        : p.stoneColor;
    const [a, b, c] = corners.map((corner) =>
      mesh.vertex(corner.position, corner.normal, color, uvOf(corner.position, normal))
    );
    mesh.triangle(a, b, c);
  };
  const corner = (i, s) => points[i][s % SIDES];
  for (let i = 0; i < RINGS; i++) {
    for (let s = 0; s < SIDES; s++) {
      facet([corner(i, s), corner(i, s + 1), corner(i + 1, s + 1)]);
      facet([corner(i, s), corner(i + 1, s + 1), corner(i + 1, s)]);
    }
  }
  // The top closes over its middle.
  const middle = {position: top, normal: normalize(topSum), mossy: p.moss > 0};
  middle.lit = dot(middle.normal, HIGHLIGHT) > 0.8;
  for (let s = 0; s < SIDES; s++) {
    facet([middle, corner(RINGS, s), corner(RINGS, s + 1)]);
  }

  // Its collider stands under its top, which the lean shifts, and reaches out
  // as far as its narrower side, short of its lumps and facets, so it can be
  // landed on anywhere above it. Its dome is its round top's, a ball's, from
  // its height at the middle to the ground at its edge.
  const radius = Math.min(p.width, p.depth) * (1 - p.lumps) * (1 - p.cut / 2);
  const shift = p.lean * p.height * 0.5;
  const colliders = [
    {
      name: "top",
      shape: "cylinder",
      radius,
      height,
      dome: height,
      position: [leanTo[0] * shift, height / 2, leanTo[2] * shift],
    },
  ];
  return {mesh, colliders};
}

// lighten is color lightened by highlight, for the painted highlight where
// the moss faces HIGHLIGHT.
function lighten(color, highlight) {
  return color.map((v) => v + (1 - v) * highlight);
}

function main() {
  const {seed: seedArg, style = "boulder", out, ...overrides} = parseArgs(process.argv.slice(2));
  if (!styles[style]) {
    throw new Error(`unknown style "${style}"; styles are ${Object.keys(styles).join(", ")}`);
  }
  const seed = seedArg != null ? Number(seedArg) : null;
  if (seed != null && !Number.isInteger(seed)) {
    throw new Error(`--seed must be a whole number, not "${seedArg}"`);
  }

  // A seed varies the style's sizes.
  const parameters = {...styles[style]};
  if (seed != null) {
    const random = mulberry32(seed);
    const vary = (value, by) => value * (1 - by + random() * 2 * by);
    parameters.width = vary(parameters.width, 0.15);
    parameters.depth = vary(parameters.depth, 0.15);
    parameters.height = vary(parameters.height, 0.15);
    parameters.drips = Math.round(vary(parameters.drips, 0.3));
  }

  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in boulder)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are seed, style, out, ${Object.keys(boulder).join(", ")}`
      );
    }
    parameters[name] = Array.isArray(boulder[name])
      ? String(value).split(",").map(Number)
      : Number(value);
  }
  parameters.drips = Math.max(0, Math.round(parameters.drips));

  const filename = out || (seed != null ? `rock-${style}-${seed}.obj` : `rock-${style}.obj`);
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const round = (_, v) => (typeof v === "number" ? Number(v.toFixed(3)) : v);
  const rounded = JSON.stringify(parameters, round);
  // The lumps and drips get their own random numbers, from the seed, or 0,
  // so overriding a parameter doesn't reshape the rock.
  const {mesh, colliders} = buildRock(parameters, mulberry32((seed ?? 0) + 7919));
  const roundedColliders = JSON.stringify(colliders, round);
  fs.writeFileSync(
    output,
    mesh.toObj(
      [
        "Generated by bin/generate-rock.js",
        seed == null ? `Style ${style}` : `Seed ${seed}, style ${style}`,
        `Parameters ${rounded}`,
        `Colliders ${roundedColliders}`,
      ],
      "rock"
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
