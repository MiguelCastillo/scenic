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
//   more bubbles filling in between and on top. Branches can fork again
//   into smaller twigs, each with a smaller bubble of its own.
// - sprig: a thin, straight trunk with straight branches forking off at
//   different heights, each ending in one bubble, like a simple drawing.
// - tall: a column of bubbles stacked up the trunk, like a poplar.
// - pine: rings of bubbles that shrink toward the top, like a fir.
// - lollipop: one big bubble on a thin trunk, with a few small ones tucked
//   under it.
// - canopy: the trunk forks into a few limbs that fork again into twigs,
//   with small bubbles on their tips amid bigger bubbles filling in the
//   crown, more small bubbles nestled into its surface, and tiny ones
//   floating around its edge: bubbles of all sizes, mostly small.
// - cloud: a leaning trunk with limbs reaching out nearly level at
//   different heights, each holding up a flat pad of bubbles, like a tree
//   pruned into clouds. Lower limbs reach farther and hold bigger pads.
// - weeping: a small round crown with strands of bubbles hanging from its
//   branch tips, shrinking toward the ground, like a willow or wisteria, on
//   a wide old trunk that flares out at its foot.
// - acacia: a tall trunk whose limbs reach far out to a wide, flat crown,
//   like an umbrella.
// - orchard: a full crown dotted with small, bright fruit.
//
// The tree stands on its origin, growing up +Y.
//
// Usage:
//   node bin/generate-tree.js                    the round tree, round-tree.obj
//   node bin/generate-tree.js --style pine       the pine tree, pine-tree.obj
//   node bin/generate-tree.js --seed 42          a random tree, such as canopy-tree-42.obj
//   node bin/generate-tree.js --random           a random tree from a new seed
//   node bin/generate-tree.js --seed 42 --style round --branches 5 --out my-tree.obj
//   node bin/generate-tree.js --seed 42 --min-branches 2   allow as few as 2 branches
//   node bin/generate-tree.js --style weeping --bark   weeping-tree.obj and weeping-tree-bark.obj
//
// With --bark, the trunk, branches and twigs are a file of their own, its
// name with -bark on the end, with texture coordinates for a bark texture,
// which wraps around them twice and runs along them at the same scale (see
// bin/generate-texture.js and textures on a static mesh in the README), and
// the rest, its leaves, is the tree's file. Both files' headers name the
// tree's meta file, which has one of its own.
//
// A seed always makes the same tree. It picks a style unless --style names
// one, then picks the branches, where the bubbles go, how big they are, and
// their colors. Any parameter below can also be set by name, such as
// `--bubbles 9`, `--branch-angle 50` or `--trunk-color 0.5,0.3,0.2`, and it
// wins over what the seed picks. leafColors is a list of colors, written
// `--leaf-colors 0.4,0.7,0.1;0.6,0.8,0.2`, and each bubble picks one. Files
// are written to resources/obj unless --out says otherwise. The parameters a
// tree was made with are printed, and saved in the tree's meta file,
// along with its colliders: upright cylinders around its trunk and its
// crown, each with its position, for colliders in a scene (see collision in
// @scenic/scene). Leaning trunks and branches reaching out from the crown are
// left out, so they are a close fit rather than exact. Its skeleton is saved
// there too: every tube of its trunk, branches and twigs, as {points, radii},
// the three points of its curve and its radius at five even steps along it,
// for things to walk along the tree (see games/wingborn/scripts/fly.js).

const fs = require("fs");
const path = require("path");

const {Mesh, add, sub, scale, dot, cross, normalize, hsl, parseArgs} = require("./lib/mesh.js");
const {metaHeader, writeMeta} = require("./generate-obj-meta.js");

// The styles' parameters, in scene units and degrees. The round one also says
// what each parameter means.
const styles = {
  round: {
    crown: "round", // how bubbles are placed: round, cloud, tall, pine or lollipop
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
    twigs: 0, // how many smaller branches fork off each branch, each with a bubble
    topBubble: 1, // 1 for a bubble on top of the trunk, 0 for none
    bubbles: 6, // how many leaf bubbles
    bubbleSize: 95, // the bubbles' average radius
    tipSize: 1, // how big bubbles on branch tips are, as a part of bubbleSize;
    // twigs' bubbles are about two thirds of that
    fillSize: 0.95, // how big the bubbles filling in the crown are, as a part
    // of bubbleSize
    smallBubbles: 0, // how many small bubbles nestle half sunk into the
    // crown's surface, a quarter to half of bubbleSize across
    dots: 0, // how many tiny bubbles float around the edge of the crown
    crownHeight: 0.9, // how far above the branch tips the crown's filling
    // bubbles reach, as a part of bubbleSize; small for a flat crown
    strands: 0, // how many strands of bubbles hang from each branch and twig
    // tip, like a weeping willow
    strandBubbles: 5, // how many bubbles each strand has, shrinking downward
    strandSpacing: 0, // how far apart a strand's bubbles hang, as a part of
    // their size: 0 is touching, a chain, and more hangs them apart on a thin
    // branch
    fruit: 0, // how many small fruit bubbles dot the crown's surface
    fruitColor: [0.9, 0.2, 0.2], // the fruit's color, as [r, g, b]
    bubbleVariety: 0.2, // how much bubbles' sizes vary, 0 to 1: at 0.6, from
    // under half the average size to over one and a half times it
    crownSpread: 1, // how far apart the bubbles spread, 1 is snug
    crownWidth: 1, // how far out to its sides a round crown reaches, as a
    // part of how its branches reach: 1 is as they do, and more spreads its
    // branches, twigs and bubbles out wider without making it taller
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
    twigs: 0,
    topBubble: 0,
    bubbles: 4,
    bubbleSize: 50,
    tipSize: 1,
    fillSize: 0.95,
    smallBubbles: 0,
    dots: 0,
    crownHeight: 0.9,
    strands: 0,
    strandBubbles: 5,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
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
    twigs: 0,
    topBubble: 1,
    bubbles: 9,
    bubbleSize: 70,
    tipSize: 1,
    fillSize: 0.95,
    smallBubbles: 0,
    dots: 0,
    crownHeight: 0.9,
    strands: 0,
    strandBubbles: 5,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
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
    twigs: 0,
    topBubble: 1,
    bubbles: 12,
    bubbleSize: 60,
    tipSize: 1,
    fillSize: 0.95,
    smallBubbles: 0,
    dots: 0,
    crownHeight: 0.9,
    strands: 0,
    strandBubbles: 5,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
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
    twigs: 0,
    topBubble: 1,
    bubbles: 4,
    bubbleSize: 110,
    tipSize: 1,
    fillSize: 0.95,
    smallBubbles: 0,
    dots: 0,
    crownHeight: 0.9,
    strands: 0,
    strandBubbles: 5,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
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
  canopy: {
    crown: "round",
    trunkHeight: 190,
    trunkRadius: 24,
    trunkTaper: 0.6,
    trunkLean: 14,
    rootFlare: 1.6,
    branches: 3,
    minBranches: 3,
    branchAngle: 45,
    branchLength: 200,
    branchStart: 0.75,
    branchRadius: 0.6,
    branchCurve: 0.6,
    branchStagger: 0.3,
    twigs: 2,
    topBubble: 1,
    bubbles: 17,
    bubbleSize: 70,
    tipSize: 0.8,
    fillSize: 1.15,
    smallBubbles: 12,
    dots: 6,
    crownHeight: 0.9,
    strands: 0,
    strandBubbles: 5,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
    bubbleVariety: 0.3,
    crownSpread: 1.1,
    squash: 1,
    highlight: 0.35,
    highlightSize: 0.3,
    trunkColor: [0.45, 0.32, 0.22],
    leafColors: [
      [0.36, 0.72, 0.58],
      [0.62, 0.8, 0.78],
      [0.72, 0.84, 0.5],
      [0.9, 0.92, 0.7],
    ],
  },
  cloud: {
    crown: "cloud",
    trunkHeight: 230,
    trunkRadius: 20,
    trunkTaper: 0.55,
    trunkLean: 70,
    rootFlare: 1.6,
    branches: 4,
    minBranches: 3,
    branchAngle: 72,
    branchLength: 150,
    branchStart: 0.35,
    branchRadius: 0.6,
    branchCurve: 0.6,
    branchStagger: 0,
    twigs: 0,
    topBubble: 1,
    bubbles: 7,
    bubbleSize: 50,
    tipSize: 1,
    fillSize: 1,
    smallBubbles: 0,
    dots: 0,
    crownHeight: 0.9,
    strands: 0,
    strandBubbles: 5,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
    bubbleVariety: 0.15,
    crownSpread: 1,
    squash: 0.7,
    highlight: 0.3,
    highlightSize: 0.35,
    trunkColor: [0.42, 0.3, 0.24],
    leafColors: [
      [0.2, 0.5, 0.3],
      [0.26, 0.58, 0.32],
      [0.34, 0.64, 0.36],
    ],
  },
  weeping: {
    crown: "round",
    trunkHeight: 220,
    trunkRadius: 38,
    trunkTaper: 0.55,
    trunkLean: 6,
    rootFlare: 2.4,
    branches: 7,
    minBranches: 6,
    branchAngle: 65,
    branchLength: 220,
    branchStart: 0.84,
    branchRadius: 0.5,
    branchCurve: 1,
    branchStagger: 0.2,
    twigs: 2,
    topBubble: 1,
    bubbles: 24,
    bubbleSize: 51,
    tipSize: 0.9,
    fillSize: 1,
    smallBubbles: 6,
    dots: 0,
    crownHeight: 0.6,
    strands: 3,
    strandBubbles: 4,
    strandSpacing: 1.2,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
    bubbleVariety: 0.2,
    crownSpread: 1,
    crownWidth: 1.8,
    squash: 1,
    highlight: 0.3,
    highlightSize: 0.3,
    trunkColor: [0.55, 0.33, 0.22],
    leafColors: [
      [0.65, 0.77, 0.47],
      [0.73, 0.87, 0.6],
    ],
  },
  acacia: {
    crown: "round",
    trunkHeight: 300,
    trunkRadius: 20,
    trunkTaper: 0.6,
    trunkLean: 30,
    rootFlare: 1.5,
    branches: 4,
    minBranches: 3,
    branchAngle: 60,
    branchLength: 230,
    branchStart: 0.85,
    branchRadius: 0.55,
    branchCurve: 1,
    branchStagger: 0.15,
    twigs: 2,
    topBubble: 1,
    bubbles: 22,
    bubbleSize: 55,
    tipSize: 0.9,
    fillSize: 1,
    smallBubbles: 10,
    dots: 0,
    crownHeight: 0.25,
    strands: 0,
    strandBubbles: 5,
    fruit: 0,
    fruitColor: [0.9, 0.2, 0.2],
    bubbleVariety: 0.25,
    crownSpread: 1.3,
    squash: 0.75,
    highlight: 0.3,
    highlightSize: 0.35,
    trunkColor: [0.5, 0.36, 0.25],
    leafColors: [
      [0.5, 0.62, 0.2],
      [0.58, 0.68, 0.24],
      [0.68, 0.72, 0.3],
    ],
  },
  orchard: {
    crown: "round",
    trunkHeight: 170,
    trunkRadius: 24,
    trunkTaper: 0.6,
    trunkLean: 12,
    rootFlare: 1.6,
    branches: 4,
    minBranches: 3,
    branchAngle: 45,
    branchLength: 170,
    branchStart: 0.7,
    branchRadius: 0.6,
    branchCurve: 0.7,
    branchStagger: 0.25,
    twigs: 1,
    topBubble: 1,
    bubbles: 16,
    bubbleSize: 70,
    tipSize: 0.85,
    fillSize: 1.1,
    smallBubbles: 10,
    dots: 0,
    crownHeight: 0.9,
    strands: 0,
    strandBubbles: 5,
    fruit: 16,
    fruitColor: [0.9, 0.2, 0.2],
    bubbleVariety: 0.25,
    crownSpread: 1,
    squash: 0.95,
    highlight: 0.3,
    highlightSize: 0.35,
    trunkColor: [0.45, 0.3, 0.2],
    leafColors: [
      [0.28, 0.58, 0.22],
      [0.36, 0.66, 0.26],
      [0.22, 0.5, 0.24],
    ],
  },
};

// The leaf palettes random trees pick from, as hues with a spread to vary
// them by, and their saturation and lightness ranges. Each tree picks a few
// colors from one, so its bubbles can differ while still going together. A
// canopy tree also picks a color or two from a second palette, for accents.
const palettes = {
  green: {hue: 0.25, spread: 0.06, saturation: [0.55, 0.75], lightness: [0.38, 0.5]},
  spring: {hue: 0.2, spread: 0.05, saturation: [0.65, 0.85], lightness: [0.48, 0.6]},
  forest: {hue: 0.36, spread: 0.06, saturation: [0.45, 0.65], lightness: [0.34, 0.44]},
  autumn: {hue: 0.07, spread: 0.07, saturation: [0.75, 0.9], lightness: [0.48, 0.58]},
  blossom: {hue: 0.93, spread: 0.04, saturation: [0.6, 0.8], lightness: [0.7, 0.8]},
  mint: {hue: 0.33, spread: 0.15, saturation: [0.35, 0.55], lightness: [0.6, 0.75]},
  ocean: {hue: 0.5, spread: 0.06, saturation: [0.4, 0.6], lightness: [0.55, 0.7]},
  lemon: {hue: 0.15, spread: 0.03, saturation: [0.6, 0.8], lightness: [0.65, 0.78]},
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

  const paletteName = pick(
    {
      pine: ["green", "forest", "forest", "candy"],
      cloud: ["forest", "green", "blossom", "mint"],
      weeping: ["candy", "blossom", "spring", "mint", "lemon"],
      acacia: ["green", "spring", "autumn", "lemon", "forest"],
      orchard: ["green", "forest", "spring"],
    }[name] || Object.keys(palettes)
  );
  const colorsFrom = (palette, count) =>
    Array.from({length: count}, () =>
      hsl(
        (palette.hue + between(-palette.spread, palette.spread) + 1) % 1,
        between(...palette.saturation),
        between(...palette.lightness)
      )
    );
  const leafColors =
    name === "canopy"
      ? [
          ...colorsFrom(palettes[paletteName], pick([3, 4])),
          ...colorsFrom(
            palettes[pick(Object.keys(palettes).filter((other) => other !== paletteName))],
            pick([1, 2])
          ),
        ]
      : colorsFrom(palettes[paletteName], pick([1, 2, 2, 3]));

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
  // Some forking trees are bushier, with more branches or with twigs forking
  // off their branches, and their bubbles come in all sizes, from small to
  // large.
  if (name === "round") {
    const branches = fewest + pick([0, 0, 1, 2, 3, 4]);
    Object.assign(parameters, {
      branches,
      twigs: pick([0, 0, 1, 2]),
      bubbles: branches + 1 + pick([0, 1, 2, 3]),
      bubbleVariety: between(0.15, 0.6),
    });
  } else if (name === "sprig") {
    const branches = fewest + pick([0, 0, 1, 2, 4]);
    Object.assign(parameters, {
      branches,
      twigs: pick([0, 0, 1, 1, 2]),
      bubbleVariety: between(0.1, 0.55),
      branchStagger: between(0.2, 0.5),
      bubbles: branches + (random() < 0.3 ? 1 : 0),
      topBubble: random() < 0.3 ? 1 : 0,
      trunkColor: hsl(between(0.05, 0.6), between(0, 0.25), between(0.25, 0.4)),
    });
  } else if (name === "canopy") {
    const branches = fewest + pick([0, 1, 1, 2]);
    const twigs = pick([1, 2, 2, 3]);
    Object.assign(parameters, {
      branches,
      twigs,
      bubbles: branches * (1 + twigs) + 1 + pick([4, 5, 6]),
      smallBubbles: pick([8, 12, 16]),
      dots: pick([3, 5, 7]),
      bubbleVariety: between(0.2, 0.4),
      fillSize: between(1, 1.3),
    });
  } else if (name === "cloud") {
    Object.assign(parameters, {
      branches: fewest + pick([0, 1, 2]),
      bubbles: pick([5, 6, 7]),
      trunkLean: style.trunkLean * between(0.6, 1.3),
    });
  } else if (name === "weeping") {
    Object.assign(parameters, {
      branches: fewest + pick([0, 1, 2]),
      twigs: pick([0, 1, 1]),
      strands: pick([2, 3, 3]),
      strandBubbles: pick([3, 4, 4]),
    });
  } else if (name === "acacia") {
    Object.assign(parameters, {
      branches: fewest + pick([0, 1, 2]),
      twigs: pick([1, 2, 2]),
      crownHeight: between(0.15, 0.35),
    });
  } else if (name === "orchard") {
    Object.assign(parameters, {
      branches: fewest + pick([0, 1, 1, 2]),
      fruit: pick([10, 14, 18]),
      fruitColor: pick([
        [0.9, 0.2, 0.2],
        [1, 0.55, 0.1],
        [1, 0.88, 0.2],
        [0.55, 0.2, 0.6],
      ]),
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
const BARK_WRAPS = 2; // how many times a bark texture wraps around a tube
const BUBBLE_SIDES = 28; // around a big bubble; smaller ones get fewer
const BUBBLE_RINGS = 18; // from a big bubble's bottom to its top

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
// twist. It has sides around it and steps along it, fewer for thin, straight
// ones, which are small on screen. Given a skeleton, a list, it adds itself
// to it, as {points, radii}.
function tube(
  mesh,
  [p0, p1, p2],
  radiusAt,
  color,
  p,
  {sides = TUBE_SIDES, steps = TUBE_STEPS, skeleton, textured = false} = {}
) {
  skeleton?.push({points: [p0, p1, p2], radii: [0, 0.25, 0.5, 0.75, 1].map(radiusAt)});
  const points = Array.from({length: steps + 1}, (_, i) => curve(p0, p1, p2, i / steps));
  // A textured tube has texture coordinates: the texture wraps around it
  // BARK_WRAPS times, and runs along it at the same scale, from how far
  // along it is, so it isn't stretched. Its first side is doubled, at the
  // far end of the texture, so the texture doesn't smear back across the
  // seam.
  const around = textured ? sides + 1 : sides;
  const radii = points.map((_, i) => radiusAt(i / steps));
  const meanRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length || 1;
  const repeat = (2 * Math.PI * meanRadius) / BARK_WRAPS;
  let along = 0;
  let side = null;
  const rings = points.map((point, i) => {
    const tangent = normalize(sub(points[Math.min(i + 1, steps)], points[Math.max(i - 1, 0)]));
    if (!side) {
      const reference = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      side = normalize(cross(tangent, reference));
    } else {
      side = normalize(sub(side, scale(tangent, dot(side, tangent))));
    }
    const other = cross(tangent, side);
    const radius = radii[i];
    along += i ? Math.hypot(...sub(point, points[i - 1])) : 0;

    return Array.from({length: around}, (_, s) => {
      const angle = (s / sides) * 2 * Math.PI;
      const normal = add(scale(side, Math.cos(angle)), scale(other, Math.sin(angle)));
      return mesh.vertex(
        add(point, scale(normal, radius)),
        normal,
        shade(color, normal, {...p, highlight: p.highlight * 0.5}),
        textured ? [(s / sides) * BARK_WRAPS, along / repeat] : undefined
      );
    });
  });

  for (let i = 0; i < steps; i++) {
    for (let s = 0; s < sides; s++) {
      const t = textured ? s + 1 : (s + 1) % sides;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// bubble adds a leaf bubble: a sphere, squashed by squash, in one color with
// a highlight.
function bubble(mesh, center, radius, color, p) {
  // Small bubbles are seen small, so they get fewer sides and rings, down to
  // a third of a big one's, which keeps trees with many of them light.
  const detail = Math.max(1 / 3, Math.min(1, radius / 60));
  const sides = Math.round(BUBBLE_SIDES * detail);
  const ringCount = Math.round(BUBBLE_RINGS * detail);
  const rings = Array.from({length: ringCount + 1}, (_, i) => {
    const latitude = Math.PI * (i / ringCount - 0.5);
    return Array.from({length: sides}, (_, s) => {
      const longitude = (s / sides) * 2 * Math.PI;
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

  for (let i = 0; i < ringCount; i++) {
    for (let s = 0; s < sides; s++) {
      const t = (s + 1) % sides;
      mesh.quad(rings[i][s], rings[i][t], rings[i + 1][t], rings[i + 1][s]);
    }
  }
}

// buildTree builds the tree's mesh from its parameters, using random for the
// details its parameters leave open, such as exactly where each bubble goes.
// It returns the mesh, its colliders and skeleton, and, textured, its bark:
// its trunk, branches and twigs, apart, with texture coordinates.
function buildTree(p, random, {textured = false} = {}) {
  const between = (min, max) => min + (max - min) * random();
  const mesh = new Mesh();
  // The trunk, branches and twigs, which, textured, are a mesh of their own,
  // with texture coordinates for bark.
  const bark = textured ? new Mesh() : mesh;
  // The tubes of its trunk, branches and twigs, for walking along it.
  const skeleton = [];

  // The trunk leans its top a little to one side, curving there.
  const leanAngle = between(0, 2 * Math.PI);
  const top = [Math.cos(leanAngle) * p.trunkLean, p.trunkHeight, Math.sin(leanAngle) * p.trunkLean];
  const trunk = [[0, 0, 0], [0, p.trunkHeight * 0.5, 0], top];
  const trunkRadiusAt = (t) =>
    p.trunkRadius * (1 + (p.trunkTaper - 1) * t) * (1 + (p.rootFlare - 1) * (1 - t) ** 6);
  tube(bark, trunk, trunkRadiusAt, p.trunkColor, p, {skeleton, textured});

  // Bubbles are placed as [center, radius] pairs, then built.
  const sized = (factor = 1) =>
    p.bubbleSize * factor * between(1 - p.bubbleVariety, 1 + p.bubbleVariety);
  const bubbles = [];
  const spread = p.crownSpread;

  if (p.crown === "round") {
    const anchors = [];
    // The bubbles on the branches' and twigs' tips, which strands hang from.
    const tips = [];

    // Branches fork evenly around the trunk, each leaning out and curving
    // up, with a bubble on its tip.
    const twist = between(0, 2 * Math.PI);
    const branchRadius = p.trunkRadius * p.trunkTaper * p.branchRadius;
    // Styles made before crownWidth don't have it.
    const width = p.crownWidth ?? 1;
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
      // A wider crown stretches how far the branch reaches out, not up.
      const reach = [out[0] * width, out[1], out[2] * width];
      // A curving branch bends at its middle and lifts its tip; a straight
      // one runs straight from its fork to its tip.
      const end = add(add(start, scale(reach, length)), [0, length * 0.25 * p.branchCurve, 0]);
      const straightBend = scale(add(start, end), 0.5);
      const curvedBend = add(start, scale(reach, length * 0.55));
      const bend = add(scale(straightBend, 1 - p.branchCurve), scale(curvedBend, p.branchCurve));
      tube(bark, [start, bend, end], (t) => branchRadius * (1 - 0.35 * t), p.trunkColor, p, {
        skeleton,
        textured,
      });
      anchors.push(end);
      bubbles.push([end, sized(p.tipSize)]);
      tips.push(bubbles[bubbles.length - 1]);

      // Twigs fork off along the branch, turned to either side of it and
      // leaning out further, each about half as long and as thick as the
      // branch, with a smaller bubble on its tip.
      for (let w = 0; w < p.twigs; w++) {
        const side = w % 2 ? -1 : 1;
        const twigAround = around + side * between(0.6, 1.1);
        const twigLean = Math.min(lean + between(0.15, 0.4), (80 * Math.PI) / 180);
        const twigOut = [
          Math.cos(twigAround) * Math.sin(twigLean) * width,
          Math.cos(twigLean),
          Math.sin(twigAround) * Math.sin(twigLean) * width,
        ];
        const forkT = between(0.4, 0.75);
        const twigStart = curve(start, bend, end, forkT);
        const twigLength = length * between(0.4, 0.6);
        const twigEnd = add(add(twigStart, scale(twigOut, twigLength)), [
          0,
          twigLength * 0.25 * p.branchCurve,
          0,
        ]);
        const twigBend = add(
          scale(scale(add(twigStart, twigEnd), 0.5), 1 - p.branchCurve),
          scale(add(twigStart, scale(twigOut, twigLength * 0.55)), p.branchCurve)
        );
        const twigRadius = branchRadius * (1 - 0.35 * forkT) * 0.6;
        tube(
          bark,
          [twigStart, twigBend, twigEnd],
          (t) => twigRadius * (1 - 0.35 * t),
          p.trunkColor,
          p,
          {skeleton, textured}
        );
        bubbles.push([twigEnd, sized(p.tipSize * 0.65)]);
        tips.push(bubbles[bubbles.length - 1]);
      }
    }

    // A bubble crowns the trunk, a little above its top.
    // The trunk's top is rounded off, so where it splits into branches is a
    // smooth knot rather than an open end.
    bubble(mesh, top, p.trunkRadius * p.trunkTaper, p.trunkColor, {...p, highlight: 0, squash: 1});

    if (p.topBubble) {
      const crownTop = add(top, [0, p.bubbleSize * 0.6 * spread, 0]);
      bubbles.push([crownTop, sized(1.1 * p.tipSize)]);
      anchors.push(crownTop);
    }

    // The rest fill in between and above the others, so the crown reads as
    // one rounded mass. A filling bubble is kept small enough that it covers
    // no other bubble's center, so the bubbles on the tips still poke out of
    // it and filling bubbles don't pile up into one big clump. A few places
    // are tried for each, taking the first where it can be most of the size
    // it wants, or else the one where it can be biggest.
    const center = anchors.length
      ? scale(anchors.reduce(add, [0, 0, 0]), 1 / anchors.length)
      : add(top, [0, p.bubbleSize * 0.6 * spread, 0]);
    for (let i = bubbles.length; i < p.bubbles; i++) {
      const wanted = sized(p.fillSize);
      let best = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const angle = between(0, 2 * Math.PI);
        const reach = p.bubbleSize * spread * width * between(0.5, 1.1);
        const lift = p.bubbleSize * spread * between(-0.2, p.crownHeight);
        const position = add(center, [Math.cos(angle) * reach, lift, Math.sin(angle) * reach]);
        const radius = Math.min(
          wanted,
          ...bubbles.map(
            ([other, otherRadius]) => Math.hypot(...sub(other, position)) - otherRadius * 0.4
          )
        );
        if (!best || radius > best[1]) {
          best = [position, radius];
        }
        if (radius > wanted * 0.75) {
          break;
        }
      }
      if (best[1] > wanted * 0.4) {
        bubbles.push(best);
      }
    }

    // Small bubbles nestle into the crown's surface, each half sunk into a
    // bubble already there. Where one would be buried in another bubble, a
    // few other places are tried, and it is left out if none shows.
    for (let i = 0; i < p.smallBubbles; i++) {
      const radius = p.bubbleSize * between(0.25, 0.5);
      for (let attempt = 0; attempt < 8; attempt++) {
        const [near, nearRadius] = bubbles[Math.floor(random() * bubbles.length)];
        const angle = between(0, 2 * Math.PI);
        const away = normalize(
          add(
            sub(near, center),
            scale([Math.cos(angle), between(-0.6, 0.8), Math.sin(angle)], nearRadius)
          )
        );
        const position = add(near, scale(away, nearRadius * between(0.85, 1)));
        const buried = bubbles.some(
          ([other, otherRadius]) => Math.hypot(...sub(other, position)) < otherRadius - radius * 0.3
        );
        if (!buried) {
          bubbles.push([position, radius]);
          break;
        }
      }
    }

    // Fruit dots the crown's surface, each mostly sunk into a bubble, in its
    // own color.
    const leaves = [...bubbles];
    for (let i = 0; i < p.fruit; i++) {
      const radius = p.bubbleSize * between(0.1, 0.15);
      for (let attempt = 0; attempt < 8; attempt++) {
        const [near, nearRadius] = leaves[Math.floor(random() * leaves.length)];
        const angle = between(0, 2 * Math.PI);
        const away = normalize(
          add(
            sub(near, center),
            scale([Math.cos(angle), between(-0.8, 0.6), Math.sin(angle)], nearRadius)
          )
        );
        const position = add(near, scale(away, nearRadius * 0.98));
        const buried = bubbles.some(
          ([other, otherRadius]) => Math.hypot(...sub(other, position)) < otherRadius - radius * 0.5
        );
        if (!buried) {
          bubbles.push([position, radius, p.fruitColor]);
          break;
        }
      }
    }

    // Tiny bubbles float around the edge of the crown, just outside the
    // bubbles they are by.
    const placed = [...bubbles];
    for (let i = 0; i < p.dots; i++) {
      const [near, nearRadius] = placed[Math.floor(random() * placed.length)];
      const angle = between(0, 2 * Math.PI);
      const away = normalize(
        add(sub(near, center), [Math.cos(angle), between(-0.5, 0.5), Math.sin(angle)])
      );
      const radius = p.bubbleSize * between(0.1, 0.2);
      bubbles.push([add(near, scale(away, nearRadius + radius * between(1, 2.5))), radius]);
    }

    // Strands hang from the tips: a chain of bubbles from under each tip,
    // each a little smaller than the one above it and drifting out from the
    // trunk, like a weeping willow's. Spaced apart, the bubbles hang on a
    // thin branch that runs down through them from the tip.
    const spacing = p.strandSpacing ?? 0;
    const strandRadius = p.trunkRadius * p.trunkTaper * p.branchRadius * 0.3;
    for (const [tip, tipRadius] of tips) {
      const outward = normalize([tip[0] - top[0], 0, tip[2] - top[2]]);
      for (let k = 0; k < p.strands; k++) {
        const angle = between(0, 2 * Math.PI);
        let radius = tipRadius * between(0.4, 0.55);
        let position = add(tip, [
          Math.cos(angle) * tipRadius * 0.5,
          -tipRadius * (0.75 + spacing * 0.6),
          Math.sin(angle) * tipRadius * 0.5,
        ]);
        const strand = [tip];
        for (let n = 0; n < p.strandBubbles; n++) {
          bubbles.push([position, radius]);
          strand.push(position);
          const next = radius * between(0.8, 0.9);
          position = add(
            position,
            add(
              [0, -(radius + next) * 0.75 * (1 + spacing), 0],
              scale(outward, next * 0.3 * (1 + spacing))
            )
          );
          radius = next;
        }
        if (spacing > 0) {
          for (let i = 0; i < strand.length - 1; i++) {
            const [from, to] = [strand[i], strand[i + 1]];
            const along = (t) => (i + t) / (strand.length - 1);
            tube(
              bark,
              [from, scale(add(from, to), 0.5), to],
              (t) => strandRadius * (1 - 0.5 * along(t)),
              p.trunkColor,
              p,
              {sides: 6, steps: 1, textured}
            );
          }
        }
      }
    }
  } else if (p.crown === "cloud") {
    // Limbs reach out nearly level at heights from branchStart to the top
    // of the trunk, each turned well around from the one below. Lower limbs
    // reach farther and hold bigger pads, the way cloud-pruned trees are
    // shaped. Each pad is a flat cluster of bubbles: one in the middle and
    // a ring of smaller ones around it, bubbles bubbles in all.
    const pad = (padCenter, size) => {
      bubbles.push([padCenter, sized(0.8 * size)]);
      const ring = p.bubbles - 1;
      const turn = between(0, 2 * Math.PI);
      for (let i = 0; i < ring; i++) {
        const angle = turn + (i / ring) * 2 * Math.PI + between(-0.2, 0.2);
        const reach = p.bubbleSize * 0.75 * size * spread * between(0.85, 1.1);
        bubbles.push([
          add(padCenter, [
            Math.cos(angle) * reach,
            p.bubbleSize * size * between(-0.1, 0.2),
            Math.sin(angle) * reach,
          ]),
          sized(0.55 * size),
        ]);
      }
    };

    const twist = between(0, 2 * Math.PI);
    const branchRadius = p.trunkRadius * p.trunkTaper * p.branchRadius;
    for (let b = 0; b < p.branches; b++) {
      const order = p.branches > 1 ? b / (p.branches - 1) : 1;
      const start = curve(...trunk, p.branchStart + (0.95 - p.branchStart) * order);
      const around = twist + b * 2.4 + between(-0.3, 0.3);
      const lean = (p.branchAngle * between(0.9, 1.1) * Math.PI) / 180;
      const out = [
        Math.cos(around) * Math.sin(lean),
        Math.cos(lean),
        Math.sin(around) * Math.sin(lean),
      ];
      const length = p.branchLength * spread * (1.15 - 0.5 * order) * between(0.9, 1.1);
      const end = add(add(start, scale(out, length)), [0, length * 0.2 * p.branchCurve, 0]);
      const bend = add(start, scale(out, length * 0.55));
      tube(bark, [start, bend, end], (t) => branchRadius * (1 - 0.35 * t), p.trunkColor, p, {
        skeleton,
        textured,
      });
      pad(add(end, [0, p.bubbleSize * 0.25, 0]), 1.15 - 0.45 * order);
    }

    // The trunk's top is rounded off, and holds the smallest pad.
    bubble(mesh, top, p.trunkRadius * p.trunkTaper, p.trunkColor, {...p, highlight: 0, squash: 1});
    if (p.topBubble) {
      pad(add(top, [0, p.bubbleSize * 0.4, 0]), 0.7);
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
  // even a one-color tree's bubbles stand apart. Fruit has its own color.
  for (const [center, radius, ownColor] of bubbles) {
    const color = ownColor || p.leafColors[Math.floor(random() * p.leafColors.length)];
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

  return {mesh, bark: textured ? bark : null, colliders, skeleton};
}

function main() {
  const {
    seed: seedArg,
    random: randomSeed,
    style: styleArg,
    out,
    bark: textured = false,
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
  for (const name of [
    "branches",
    "minBranches",
    "twigs",
    "smallBubbles",
    "dots",
    "strands",
    "strandBubbles",
    "fruit",
    "bubbles",
    "topBubble",
  ]) {
    parameters[name] = Math.max(name === "bubbles" ? 1 : 0, Math.round(parameters[name]));
  }
  if (parameters.crown === "round") {
    parameters.branches = Math.max(parameters.branches, parameters.minBranches);
  }

  // Files are named for their style, then their seed, if any.
  const defaultName = seed != null ? `${style}-tree-${seed}.obj` : `${style}-tree.obj`;
  const filename = out || defaultName;
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const round = (_, v) => (typeof v === "number" ? Number(v.toFixed(3)) : v);
  const rounded = JSON.stringify(parameters, round);

  // The layout of the branches and bubbles gets its own random numbers, from
  // the seed when there is one, so overriding a parameter doesn't reshuffle
  // the whole tree.
  const {mesh, bark, colliders, skeleton} = buildTree(parameters, mulberry32((seed ?? 0) + 7919), {
    textured: !!textured,
  });
  const roundedColliders = JSON.stringify(colliders, round);
  const meta = {
    generator: "bin/generate-tree.js",
    seed: seed ?? undefined,
    style,
    parameters,
    colliders,
    skeleton,
  };
  const header = metaHeader(output, meta);
  // Its bark, given --bark, is a file of its own beside it, named for it.
  const barkOutput = output.replace(/\.obj$/, "") + "-bark.obj";
  const files = [[output, mesh, "tree"], ...(bark ? [[barkOutput, bark, "bark"]] : [])];
  /* eslint-disable no-console */
  for (const [file, fileMesh, group] of files) {
    fs.writeFileSync(file, fileMesh.toObj(header, group));
    console.log(
      `wrote ${file}: ${fileMesh.vertices.length} vertices, ${fileMesh.triangles.length} triangles`
    );
  }
  writeMeta(output, meta);
  console.log(seed == null ? `style ${style}` : `seed ${seed}, style ${style}`);
  console.log(`parameters ${rounded}`);
  console.log(`colliders ${roundedColliders}`);
  /* eslint-enable no-console */
}

main();
