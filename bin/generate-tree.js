#!/usr/bin/env node
// generate-tree writes a bubbly cartoon tree as an OBJ file: a curvy trunk
// that can fork into branches, under a crown of round leaf bubbles. Each
// bubble has its own flat color, with an optional cartoon highlight on its
// upper side, and everything is colored with vertex colors, so it renders
// without a material color: the lit shaders add the material color to the
// vertex color, so leave it black, or use it to tint the tree.
//
// The crown's shape comes from its style:
// - round: the trunk forks into branches, each holding up a bubble, with
//   more bubbles filling in between and on top.
// - sprig: a thin, straight trunk with straight branches forking off at
//   different heights, each ending in one bubble, like a simple drawing.
// - tall: a column of bubbles stacked up the trunk, like a poplar.
// - pine: rings of bubbles that shrink toward the top, like a fir.
// - lollipop: one big bubble on a thin trunk, with a few small ones tucked
//   under it.
//
// The tree stands on its origin, growing up +Y.
//
// Usage:
//   node bin/generate-tree.js                    the round tree, tree.obj
//   node bin/generate-tree.js --style pine       the pine tree, tree-pine.obj
//   node bin/generate-tree.js --seed 42          a random tree, tree-42.obj
//   node bin/generate-tree.js --random           a random tree from a new seed
//   node bin/generate-tree.js --seed 42 --style round --branches 5 --out my-tree.obj
//   node bin/generate-tree.js --seed 42 --min-branches 2   allow as few as 2 branches
//
// A seed always makes the same tree. It picks a style unless --style names
// one, then picks the branches, where the bubbles go, how big they are, and
// their colors. Any parameter below can also be set by name, such as
// `--bubbles 9`, `--branch-angle 50` or `--trunk-color 0.5,0.3,0.2`, and it
// wins over what the seed picks. leafColors is a list of colors, written
// `--leaf-colors 0.4,0.7,0.1;0.6,0.8,0.2`, and each bubble picks one. Files
// are written to resources/obj unless --out says otherwise. The parameters a
// tree was made with are printed, and saved as a comment at the top of its
// file, along with its colliders: upright cylinders around its trunk and its
// crown, each with its position, for colliders in a scene (see collision in
// @scenic/scene). Leaning trunks and branches reaching out from the crown are
// left out, so they are a close fit rather than exact.

const fs = require("fs");
const path = require("path");

const {Mesh, add, sub, scale, dot, cross, normalize, hsl, parseArgs} = require("./lib/mesh.js");

// The styles' parameters, in scene units and degrees. The round one also says
// what each parameter means.
const styles = {
  round: {
    crown: "round", // how bubbles are placed: round, tall, pine or lollipop
    trunkHeight: 200, // how tall the trunk is, to where the crown starts
    trunkRadius: 26, // the trunk's radius, above its flared base
    trunkTaper: 0.65, // the trunk's radius at its top, as a part of its base
    trunkLean: 12, // how far the trunk's top leans from straight over its base
    rootFlare: 1.5, // how much wider the very base of the trunk is
    branches: 4, // how many branches fork off the trunk; 0 for none
    minBranches: 4, // the fewest branches a tree that forks gets
    branchAngle: 45, // how far branches lean out from straight up
    branchLength: 130, // how long branches are
    branchStart: 0.7, // how far up the trunk branches fork, 0 to 1; without
    // a top bubble, the trunk ends at its highest fork instead
    branchRadius: 0.5, // how thick branches are, as a part of the trunk's top
    branchCurve: 1, // how much branches curve up toward their tips; 0 is straight
    branchStagger: 0, // how far apart up the trunk branches fork, 0 to 1
    topBubble: 1, // 1 for a bubble on top of the trunk, 0 for none
    bubbles: 6, // how many leaf bubbles
    bubbleSize: 95, // the bubbles' average radius
    bubbleVariety: 0.2, // how much bubbles' sizes vary, 0 to 1
    crownSpread: 1, // how far apart the bubbles spread, 1 is snug
    squash: 0.9, // how tall bubbles are for how wide; 1 is round
    highlight: 0.3, // how much lighter each bubble's highlight is; 0 for none
    highlightSize: 0.35, // how much of a bubble its highlight covers, 0 to 1
    trunkColor: [0.55, 0.32, 0.18],
    leafColors: [
      [0.42, 0.66, 0.12],
      [0.5, 0.72, 0.15],
    ],
  },
  sprig: {
    crown: "round",
    trunkHeight: 270,
    trunkRadius: 9,
    trunkTaper: 0.55,
    trunkLean: 0,
    rootFlare: 1.2,
    branches: 4,
    minBranches: 4,
    branchAngle: 42,
    branchLength: 105,
    branchStart: 0.55,
    branchRadius: 0.9,
    branchCurve: 0,
    branchStagger: 0.35,
    topBubble: 0,
    bubbles: 4,
    bubbleSize: 50,
    bubbleVariety: 0.15,
    crownSpread: 1,
    squash: 1,
    highlight: 0.25,
    highlightSize: 0.35,
    trunkColor: [0.3, 0.3, 0.34],
    leafColors: [
      [0.45, 0.65, 0.9],
      [0.55, 0.72, 0.92],
    ],
  },
  tall: {
    crown: "tall",
    trunkHeight: 120,
    trunkRadius: 22,
    trunkTaper: 0.7,
    trunkLean: 6,
    rootFlare: 1.4,
    branches: 0,
    minBranches: 4,
    branchAngle: 30,
    branchLength: 80,
    branchStart: 0.8,
    branchRadius: 0.5,
    branchCurve: 1,
    branchStagger: 0,
    topBubble: 1,
    bubbles: 9,
    bubbleSize: 70,
    bubbleVariety: 0.15,
    crownSpread: 1,
    squash: 0.95,
    highlight: 0.3,
    highlightSize: 0.35,
    trunkColor: [0.5, 0.3, 0.18],
    leafColors: [
      [0.25, 0.55, 0.2],
      [0.3, 0.62, 0.22],
    ],
  },
  pine: {
    crown: "pine",
    trunkHeight: 90,
    trunkRadius: 24,
    trunkTaper: 0.6,
    trunkLean: 0,
    rootFlare: 1.3,
    branches: 0,
    minBranches: 4,
    branchAngle: 30,
    branchLength: 80,
    branchStart: 0.8,
    branchRadius: 0.5,
    branchCurve: 1,
    branchStagger: 0,
    topBubble: 1,
    bubbles: 12,
    bubbleSize: 60,
    bubbleVariety: 0.1,
    crownSpread: 1,
    squash: 0.85,
    highlight: 0.25,
    highlightSize: 0.35,
    trunkColor: [0.45, 0.28, 0.17],
    leafColors: [
      [0.12, 0.45, 0.3],
      [0.16, 0.52, 0.32],
    ],
  },
  lollipop: {
    crown: "lollipop",
    trunkHeight: 230,
    trunkRadius: 16,
    trunkTaper: 0.75,
    trunkLean: 18,
    rootFlare: 1.6,
    branches: 0,
    minBranches: 4,
    branchAngle: 30,
    branchLength: 80,
    branchStart: 0.8,
    branchRadius: 0.5,
    branchCurve: 1,
    branchStagger: 0,
    topBubble: 1,
    bubbles: 4,
    bubbleSize: 110,
    bubbleVariety: 0.2,
    crownSpread: 1,
    squash: 0.92,
    highlight: 0.35,
    highlightSize: 0.35,
    trunkColor: [0.6, 0.38, 0.22],
    leafColors: [
      [0.95, 0.45, 0.65],
      [0.98, 0.6, 0.75],
    ],
  },
};

// The leaf palettes random trees pick from, as hues with a spread to vary
// them by, and their saturation and lightness ranges. Each tree picks a few
// colors from one, so its bubbles can differ while still going together.
const palettes = {
  green: {hue: 0.25, spread: 0.06, saturation: [0.55, 0.75], lightness: [0.38, 0.5]},
  spring: {hue: 0.2, spread: 0.05, saturation: [0.65, 0.85], lightness: [0.48, 0.6]},
  forest: {hue: 0.36, spread: 0.06, saturation: [0.45, 0.65], lightness: [0.34, 0.44]},
  autumn: {hue: 0.07, spread: 0.07, saturation: [0.75, 0.9], lightness: [0.48, 0.58]},
  blossom: {hue: 0.93, spread: 0.04, saturation: [0.6, 0.8], lightness: [0.7, 0.8]},
  candy: {hue: 0.8, spread: 0.3, saturation: [0.55, 0.75], lightness: [0.6, 0.72]},
};

// randomParameters picks a tree's parameters from random(), which returns
// numbers in [0, 1). The proportions vary around the style's, so trees keep
// their style's shape, and most of the variety is in the branches, the
// bubbles, and color.
function randomParameters(random, styleName, minBranches) {
  const between = (min, max) => min + (max - min) * random();
  const pick = (options) => options[Math.floor(random() * options.length)];

  const name = styleName || pick(Object.keys(styles));
  const style = styles[name];
  const size = between(0.85, 1.2);
  const r = (value) => value * size * between(0.9, 1.1);

  const palette =
    palettes[
      pick(name === "pine" ? ["green", "forest", "forest", "candy"] : Object.keys(palettes))
    ];
  const leafColors = Array.from({length: pick([1, 2, 2, 3])}, () =>
    hsl(
      (palette.hue + between(-palette.spread, palette.spread) + 1) % 1,
      between(...palette.saturation),
      between(...palette.lightness)
    )
  );

  const parameters = {
    ...style,
    trunkHeight: r(style.trunkHeight),
    trunkRadius: r(style.trunkRadius),
    trunkTaper: style.trunkTaper * between(0.9, 1.1),
    trunkLean: style.trunkLean * between(0, 1.5),
    branchAngle: style.branchAngle * between(0.8, 1.2),
    branchLength: r(style.branchLength),
    branchStart: Math.min(0.9, style.branchStart * between(0.85, 1.1)),
    bubbleSize: r(style.bubbleSize),
    bubbleVariety: style.bubbleVariety * between(0.6, 1.4),
    crownSpread: between(0.9, 1.15),
    squash: style.squash * between(0.95, 1.05),
    trunkColor: hsl(between(0.05, 0.09), between(0.4, 0.6), between(0.3, 0.42)),
    leafColors,
  };

  // Trees that fork get at least minBranches branches, and sometimes a
  // couple more.
  const fewest = minBranches ?? style.minBranches;
  if (name === "round") {
    const branches = fewest + pick([0, 0, 1, 2]);
    Object.assign(parameters, {branches, bubbles: branches + 1 + pick([0, 1, 2, 3])});
  } else if (name === "sprig") {
    const branches = fewest + pick([0, 0, 1, 2]);
    Object.assign(parameters, {
      branches,
      branchStagger: between(0.2, 0.5),
      bubbles: branches + (random() < 0.3 ? 1 : 0),
      topBubble: random() < 0.3 ? 1 : 0,
      trunkColor: hsl(between(0.05, 0.6), between(0, 0.25), between(0.25, 0.4)),
    });
  } else if (name === "tall") {
    parameters.bubbles = pick([7, 9, 11]);
  } else if (name === "pine") {
    parameters.bubbles = pick([10, 12, 15]);
  } else {
    parameters.bubbles = pick([1, 3, 4, 5]);
  }

  return {style: name, parameters};
}

// Resolution.
const TUBE_SIDES = 16; // around a trunk or branch
const TUBE_STEPS = 14; // along a trunk or branch
const BUBBLE_SIDES = 28; // around a bubble
const BUBBLE_RINGS = 18; // from a bubble's bottom to its top

// The way highlights face: up, and a little to the left and front, the way
// cartoons are usually lit.
const HIGHLIGHT = normalize([-0.45, 0.8, 0.4]);

// mulberry32 is a small seeded random number generator, so a seed always
// makes the same tree. The seed is scrambled first, since nearby seeds like
// 1, 2 and 3 otherwise start with similar numbers and make similar trees.
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

// lighten mixes color toward a warm, pale yellow, the color of sunlit
// leaves, by amount.
const lighten = (color, amount) => color.map((v, i) => v + ([1, 1, 0.6][i] - v) * amount);

// shade is color lightened where normal faces the highlight, with a sharp
// edge, so bubbles get a cartoon highlight rather than a gradient.
function shade(color, normal, {highlight, highlightSize}) {
  const lit = highlight > 0 && dot(normal, HIGHLIGHT) > 1 - highlightSize;
  return lit ? lighten(color, highlight) : color;
}

// curve is a point on a quadratic Bézier curve.
const curve = (p0, p1, p2, t) =>
  add(add(scale(p0, (1 - t) ** 2), scale(p1, 2 * (1 - t) * t)), scale(p2, t * t));

// tube sweeps a circle along the quadratic curve through p0, p1 and p2, with
// radiusAt(t) giving its radius along the way, for t from 0 to 1. Its rings
// are turned as little as possible from one to the next, so it doesn't
// twist.
function tube(mesh, [p0, p1, p2], radiusAt, color, p) {
  const points = Array.from({length: TUBE_STEPS + 1}, (_, i) => curve(p0, p1, p2, i / TUBE_STEPS));
  let side = null;
  const rings = points.map((point, i) => {
    const tangent = normalize(sub(points[Math.min(i + 1, TUBE_STEPS)], points[Math.max(i - 1, 0)]));
    if (!side) {
      const reference = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      side = normalize(cross(tangent, reference));
    } else {
      side = normalize(sub(side, scale(tangent, dot(side, tangent))));
    }
    const other = cross(tangent, side);
    const radius = radiusAt(i / TUBE_STEPS);

    return Array.from({length: TUBE_SIDES}, (_, s) => {
      const angle = (s / TUBE_SIDES) * 2 * Math.PI;
      const normal = add(scale(side, Math.cos(angle)), scale(other, Math.sin(angle)));
      return mesh.vertex(
        add(point, scale(normal, radius)),
        normal,
        shade(color, normal, {...p, highlight: p.highlight * 0.5})
      );
    });
  });

  for (let i = 0; i < TUBE_STEPS; i++) {
    for (let s = 0; s < TUBE_SIDES; s++) {
      const t = (s + 1) % TUBE_SIDES;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// bubble adds a leaf bubble: a sphere, squashed by squash, in one color with
// a highlight.
function bubble(mesh, center, radius, color, p) {
  const rings = Array.from({length: BUBBLE_RINGS + 1}, (_, i) => {
    const latitude = Math.PI * (i / BUBBLE_RINGS - 0.5);
    return Array.from({length: BUBBLE_SIDES}, (_, s) => {
      const longitude = (s / BUBBLE_SIDES) * 2 * Math.PI;
      const direction = [
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude),
      ];
      // A squashed sphere's normals stretch the other way.
      const normal = normalize([direction[0], direction[1] / p.squash, direction[2]]);
      const position = add(center, [
        direction[0] * radius,
        direction[1] * radius * p.squash,
        direction[2] * radius,
      ]);
      return mesh.vertex(position, normal, shade(color, normal, p));
    });
  });

  for (let i = 0; i < BUBBLE_RINGS; i++) {
    for (let s = 0; s < BUBBLE_SIDES; s++) {
      const t = (s + 1) % BUBBLE_SIDES;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// buildTree builds the tree's mesh from its parameters, using random for the
// details its parameters leave open, such as exactly where each bubble goes.
// It returns the mesh and its colliders.
function buildTree(p, random) {
  const between = (min, max) => min + (max - min) * random();
  const mesh = new Mesh();

  // The trunk leans its top a little to one side, curving there.
  const leanAngle = between(0, 2 * Math.PI);
  const top = [Math.cos(leanAngle) * p.trunkLean, p.trunkHeight, Math.sin(leanAngle) * p.trunkLean];
  const trunk = [[0, 0, 0], [0, p.trunkHeight * 0.5, 0], top];
  const trunkRadiusAt = (t) =>
    p.trunkRadius * (1 + (p.trunkTaper - 1) * t) * (1 + (p.rootFlare - 1) * (1 - t) ** 6);
  tube(mesh, trunk, trunkRadiusAt, p.trunkColor, p);

  // Bubbles are placed as [center, radius] pairs, then built.
  const sized = (factor = 1) =>
    p.bubbleSize * factor * between(1 - p.bubbleVariety, 1 + p.bubbleVariety);
  const bubbles = [];
  const spread = p.crownSpread;

  if (p.crown === "round") {
    const anchors = [];

    // Branches fork evenly around the trunk, each leaning out and curving
    // up, with a bubble on its tip.
    const twist = between(0, 2 * Math.PI);
    const branchRadius = p.trunkRadius * p.trunkTaper * p.branchRadius;
    for (let b = 0; b < p.branches; b++) {
      const around = twist + (b / p.branches) * 2 * Math.PI + between(-0.3, 0.3);
      const lean = (p.branchAngle * between(0.85, 1.15) * Math.PI) / 180;
      const out = [
        Math.cos(around) * Math.sin(lean),
        Math.cos(lean),
        Math.sin(around) * Math.sin(lean),
      ];
      // Staggered branches fork from lower to higher in turn. Without a top
      // bubble, the trunk would end bare above its branches, so it splits
      // into them instead: the highest branch forks from its very top.
      const order = p.branches > 1 ? b / (p.branches - 1) : 1;
      const forkAt = p.topBubble
        ? Math.max(0.05, Math.min(0.98, p.branchStart + p.branchStagger * (order - 0.5)))
        : Math.max(0.05, 1 - p.branchStagger * (1 - order));
      const start = curve(...trunk, forkAt);
      const length = p.branchLength * spread * between(0.85, 1.15);
      // A curving branch bends at its middle and lifts its tip; a straight
      // one runs straight from its fork to its tip.
      const end = add(add(start, scale(out, length)), [0, length * 0.25 * p.branchCurve, 0]);
      const straightBend = scale(add(start, end), 0.5);
      const curvedBend = add(start, scale(out, length * 0.55));
      const bend = add(scale(straightBend, 1 - p.branchCurve), scale(curvedBend, p.branchCurve));
      tube(mesh, [start, bend, end], (t) => branchRadius * (1 - 0.35 * t), p.trunkColor, p);
      anchors.push(end);
      bubbles.push([end, sized()]);
    }

    // A bubble crowns the trunk, a little above its top.
    // The trunk's top is rounded off, so where it splits into branches is a
    // smooth knot rather than an open end.
    bubble(mesh, top, p.trunkRadius * p.trunkTaper, p.trunkColor, {...p, highlight: 0, squash: 1});

    if (p.topBubble) {
      const crownTop = add(top, [0, p.bubbleSize * 0.6 * spread, 0]);
      bubbles.push([crownTop, sized(1.1)]);
      anchors.push(crownTop);
    }

    // The rest fill in between and above the others, so the crown reads as
    // one rounded mass.
    const center = anchors.length
      ? scale(anchors.reduce(add, [0, 0, 0]), 1 / anchors.length)
      : add(top, [0, p.bubbleSize * 0.6 * spread, 0]);
    for (let i = bubbles.length; i < p.bubbles; i++) {
      const angle = between(0, 2 * Math.PI);
      const reach = p.bubbleSize * spread * between(0.5, 1.1);
      const lift = p.bubbleSize * spread * between(-0.2, 0.9);
      bubbles.push([
        add(center, [Math.cos(angle) * reach, lift, Math.sin(angle) * reach]),
        sized(0.95),
      ]);
    }
  } else if (p.crown === "tall") {
    // Bubbles climb the trunk in a tall teardrop, widest a third of the way
    // up and narrowing to a point. Each one steps around from the last and
    // overlaps it, so they read as one bumpy crown rather than a stack.
    const height = p.bubbleSize * 0.75 * p.bubbles * p.squash * spread;
    let angle = between(0, 2 * Math.PI);
    for (let i = 0; i < p.bubbles; i++) {
      const t = (i + 0.5) / p.bubbles;
      const width =
        Math.sin(Math.PI * Math.min(1, t / 0.35) * 0.5) *
        (1 - (0.75 * Math.max(0, t - 0.35)) / 0.65);
      const radius = sized(0.55 + 0.6 * width);
      const reach = p.bubbleSize * 0.45 * width * spread;
      angle += 2.4 + between(-0.3, 0.3);
      const y = top[1] + p.bubbleSize * 0.2 + height * t;
      bubbles.push([
        [top[0] + Math.cos(angle) * reach, y, top[2] + Math.sin(angle) * reach],
        radius,
      ]);
    }
  } else if (p.crown === "pine") {
    // Rings of bubbles around the trunk shrink toward a single bubble on
    // top, with each ring turned from the one below so they nestle.
    const layers = Math.max(1, Math.round(Math.sqrt(p.bubbles * 1.2)));
    let placed = 0;
    let y = top[1] + p.bubbleSize * 0.4;
    for (let layer = 0; layer < layers && placed < p.bubbles; layer++) {
      const t = layer / Math.max(1, layers - 1);
      const count = layer === layers - 1 ? 1 : Math.max(1, Math.round((layers - layer) * 1.4));
      const ringRadius = count === 1 ? 0 : p.bubbleSize * 1.15 * (1 - t * 0.8) * spread;
      const radius = p.bubbleSize * (1 - 0.45 * t);
      const turn = layer * 0.9 + between(0, 0.4);
      for (let i = 0; i < count && placed < p.bubbles; i++, placed++) {
        const angle = turn + (i / count) * 2 * Math.PI;
        bubbles.push([
          [top[0] + Math.cos(angle) * ringRadius, y, top[2] + Math.sin(angle) * ringRadius],
          sized(1 - 0.45 * t),
        ]);
      }
      y += radius * 1.1 * p.squash * spread;
    }
  } else if (p.crown === "lollipop") {
    // One big bubble, with small ones tucked under its sides.
    const bigRadius = sized(1.15);
    const center = add(top, [0, bigRadius * 0.75 * p.squash, 0]);
    bubbles.push([center, bigRadius]);
    for (let i = 1; i < p.bubbles; i++) {
      const angle = (i / (p.bubbles - 1)) * 2 * Math.PI + between(-0.4, 0.4);
      const reach = bigRadius * 0.85 * spread;
      bubbles.push([
        add(center, [
          Math.cos(angle) * reach,
          -bigRadius * between(0.25, 0.5),
          Math.sin(angle) * reach,
        ]),
        sized(0.45),
      ]);
    }
  } else {
    throw new Error(`unknown crown "${p.crown}"; crowns are ${Object.keys(styles).join(", ")}`);
  }

  // Each bubble picks one of the leaf colors, a little lighter or darker, so
  // even a one-color tree's bubbles stand apart.
  for (const [center, radius] of bubbles) {
    const color = p.leafColors[Math.floor(random() * p.leafColors.length)];
    const tint = between(-0.06, 0.06);
    bubble(
      mesh,
      center,
      radius,
      color.map((v) => Math.max(0, Math.min(1, v + tint))),
      p
    );
  }

  // The colliders are an upright cylinder up the trunk and one around all
  // the bubbles, centered between their farthest sides.
  const extent = (axis, side) =>
    side * Math.max(...bubbles.map(([c, r]) => side * c[axis] + r * (axis === 1 ? p.squash : 1)));
  const middle = [0, 1, 2].map((axis) => (extent(axis, 1) + extent(axis, -1)) / 2);
  const crownRadius = Math.max(
    ...bubbles.map(([c, r]) => Math.hypot(c[0] - middle[0], c[2] - middle[2]) + r)
  );
  const colliders = [
    {
      name: "trunk",
      shape: "cylinder",
      radius: p.trunkRadius,
      height: p.trunkHeight,
      position: [0, p.trunkHeight / 2, 0],
    },
    {
      name: "crown",
      shape: "cylinder",
      radius: crownRadius,
      height: extent(1, 1) - extent(1, -1),
      position: middle,
    },
  ];

  return {mesh, colliders};
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

  const styleName = styleArg || "round";
  const {style, parameters} =
    seed == null
      ? {style: styleName, parameters: {...styles[styleName]}}
      : randomParameters(
          mulberry32(seed),
          styleArg,
          overrides.minBranches != null ? Number(overrides.minBranches) : undefined
        );

  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in styles.round)) {
      throw new Error(
        `unknown parameter "--${name}"; parameters are ${Object.keys(styles.round).join(", ")}`
      );
    }
    const example = styles.round[name];
    parameters[name] =
      name === "leafColors"
        ? String(value)
            .split(";")
            .map((color) => color.split(",").map(Number))
        : Array.isArray(example)
        ? String(value).split(",").map(Number)
        : typeof example === "string"
        ? String(value)
        : Number(value);
  }
  for (const name of ["branches", "minBranches", "bubbles", "topBubble"]) {
    parameters[name] = Math.max(name === "bubbles" ? 1 : 0, Math.round(parameters[name]));
  }
  if (parameters.crown === "round") {
    parameters.branches = Math.max(parameters.branches, parameters.minBranches);
  }

  const defaultName =
    seed != null ? `tree-${seed}.obj` : style === "round" ? "tree.obj" : `tree-${style}.obj`;
  const filename = out || defaultName;
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const round = (_, v) => (typeof v === "number" ? Number(v.toFixed(3)) : v);
  const rounded = JSON.stringify(parameters, round);

  // The layout of the branches and bubbles gets its own random numbers, from
  // the seed when there is one, so overriding a parameter doesn't reshuffle
  // the whole tree.
  const {mesh, colliders} = buildTree(parameters, mulberry32((seed ?? 0) + 7919));
  const roundedColliders = JSON.stringify(colliders, round);
  fs.writeFileSync(
    output,
    mesh.toObj(
      [
        "Generated by bin/generate-tree.js",
        seed == null ? `Style ${style}` : `Seed ${seed}, style ${style}`,
        `Parameters ${rounded}`,
        `Colliders ${roundedColliders}`,
      ],
      "tree"
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
