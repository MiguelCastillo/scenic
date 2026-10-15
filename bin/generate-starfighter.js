#!/usr/bin/env node
// generate-starfighter writes a bubbly cartoon starfighter as an OBJ file.
// Rounded parts have a cartoon highlight on their upper sides, and everything
// is colored with vertex colors, so it renders without a material color: the
// lit shaders add the material color to the vertex color, so leave it black,
// or use it to tint the fighter.
//
// Fighters come from a pool of base models, its styles, and a seed makes a
// permutation of one: it picks the style, then varies its proportions, picks
// its colors, and picks among the choices the style has, such as how many
// sides a panel has. So every seed is its own fighter, while the styles are
// the base options to show:
// - cross-wing: a round fuselage under a bubble canopy with a droid dome
//   behind it, and four wings spread in an X, each with an engine pod at its
//   root and a cannon along its tip.
// - twin-panel: a ball cockpit with a big round window crossed by spokes,
//   held between two big flat panels on short arms.
// - saucer: a puffy disc with two prongs reaching forward, a cockpit tube
//   off one side, a dish and a turret on top, and a glowing engine band
//   across its back.
// - dart: a puffy arrowhead with a bubble canopy, a big engine pod with a
//   tail fin at each back corner, and cannons alongside them.
// - longwing: a long cockpit pod with a neck back to a droid's body, and a
//   crossbar holding two long engines with big round intakes.
// - atomic-saucer: a 1950s flying saucer, with a glass dome on top, a ring
//   of blinking lights around its rim, ball feet on three legs, and ray guns.
// - streamliner: a jet-age car with wings, in two candy colors split by a
//   chrome spear, with big tail fins, tail lights, and chrome bullet bumpers.
// - seedpod: an almond-shaped seed with a glowing seam, curled petal wings
//   sweeping back to its sides with their tips curled together, like a
//   squid's, sprouting antennae, and thorns.
// - teapot: a porcelain teapot with gilded edges, polka dots or a band, a
//   glass lid for a canopy, a spout that is its cannon, a handle at its back,
//   and saucer plates for wings, each with a cup of tea on it.
// - starcruiser: a big saucer with a bridge on top, a swept neck down to a
//   long hull with a glowing deflector dish at its front, and two nacelles
//   held high on swept pylons, each with a glowing collector at its front.
// - bird-of-prey: a bird-like command head on a neck ahead of a flat body,
//   and two broad striped wings angled down, with cannons on their tips.
// - battle-cruiser: a bulb command pod on a long arched neck, ahead of a
//   flat engine body with swept wings drooping out to long nacelles.
// - bumblebee: a fat striped bee, with big glossy eyes, curly antennae that
//   are its cannons, four glossy wings, six little legs, and a stinger.
//
// Each style has a rarity, and seeds pick common styles most often and rare
// ones only now and then (see rarities), so that a rare fighter is special.
//
// The fighter's nose points along +Z, which is the front that the
// third-person camera follows, its tail is at -Z, and its top is +Y.
//
// Usage:
//   node bin/generate-starfighter.js                    the cross-wing, cross-wing-starfighter.obj
//   node bin/generate-starfighter.js --style saucer     the saucer, saucer-starfighter.obj
//   node bin/generate-starfighter.js --seed 42          a random fighter, such as dart-starfighter-42.obj
//   node bin/generate-starfighter.js --random           a random fighter from a new seed
//   node bin/generate-starfighter.js --seed 42 --style cross-wing --wing-angle 25 --out my-fighter.obj
//
// A seed always makes the same fighter. It picks a style unless --style names
// one. Any of a style's parameters can also be set by name, such as
// `--wing-span 140` or `--accent-color 0.2,0.5,1`, and it wins over what the
// seed picks. Files are written to resources/obj unless --out says otherwise.
// The parameters a fighter was made with are printed, and saved as a comment
// at the top of its file, along with:
// - its exhausts, where its flames go: each one's position and radius, for
//   placing and sizing the flame that bin/generate-flame.js makes.
// - its cannons: the tip of each, as a position and the direction it fires
//   in, for shooting from.
// - its spinner, if it has one: the parts that turn around the fighter's
//   length, such as the seedpod's petals, which are written to a file of
//   their own beside the fighter's, named for it with "-spinner", so a scene
//   can turn them, such as with resources/scripts/spin.js. It
//   lists the file and the axis they turn around.
// - its translucent parts, if it has any: the see-through parts, such as the
//   bumblebee's wings, written to a file of their own named for it with
//   "-translucent", so a scene can draw them with a material's opacity (see
//   Mesh in @scenic/scene). It lists the file and the opacity they suit.
//
// Building a fighter, buildFighter, only turns parameters into a mesh, so it
// can also build fighters on the fly.

const fs = require("fs");
const path = require("path");

const {
  Mesh,
  add,
  sub,
  scale,
  dot,
  cross,
  normalize,
  hsl,
  lathe,
  parseArgs,
} = require("./lib/mesh.js");

// The styles' parameters, in scene units and degrees. Every style has a
// bodyColor, an accentColor for its stripes and details, a trimColor for its
// engines, arms and cannons, a glassColor for its canopy, and highlight: how
// much lighter its highlights are, 0 for none.
const styles = {
  "cross-wing": {
    length: 190, // the fuselage, from its tail to its nose
    radius: 30, // the fuselage's radius at its widest
    noseRadius: 15, // the fuselage's radius just behind its rounded nose
    canopyLength: 78, // how long the bubble canopy is
    wingAngle: 15, // how far each wing tilts from level, opening the X
    wingSpan: 108, // how far the wing tips reach from the fuselage's middle
    wingRoot: 72, // how long the wings are where they meet the fuselage
    wingTip: 40, // how long the wings are at their tips
    wingThickness: 12, // how thick the wings are; their edges are rounded
    stripe: 1, // 1 for a stripe across each wing near its tip, 0 for none
    engineRadius: 17, // the engine pods' radius
    engineLength: 88, // how long the engine pods are
    cannonLength: 125, // how long the wingtip cannons are
    cannonRadius: 4.5, // the cannons' radius
    highlight: 0.3,
    bodyColor: [0.93, 0.92, 0.88],
    accentColor: [0.86, 0.22, 0.2],
    trimColor: [0.66, 0.68, 0.74],
    glassColor: [0.12, 0.17, 0.32],
    droidColor: [0.95, 0.95, 0.97],
    droidAccentColor: [0.22, 0.42, 0.88],
  },
  "twin-panel": {
    ballRadius: 40, // the cockpit ball's radius
    windowSize: 0.6, // how much of the ball's front the window covers, 0 to 1
    windowSpokes: 8, // how many spokes cross the window; 0 for none
    armLength: 62, // how far the arms reach from the ball to the panels
    armRadius: 8, // the arms' radius
    panelSize: 108, // how far the panels reach from their middles to their corners
    panelSides: 6, // how many sides the panels have
    panelThickness: 10, // how thick the panels are
    panelSpokes: 1, // 1 for spokes from each panel's middle to its corners
    cannonLength: 22, // how far the cannons under the window stick out
    cannonRadius: 3.5,
    highlight: 0.3,
    bodyColor: [0.72, 0.76, 0.84],
    accentColor: [0.86, 0.22, 0.2],
    trimColor: [0.58, 0.6, 0.66],
    glassColor: [0.1, 0.14, 0.26],
    panelColor: [0.2, 0.22, 0.3], // the panels' faces, inside their rims
  },
  saucer: {
    discRadius: 110, // the disc's radius
    discHeight: 26, // how far the disc's top rises above its rim
    belly: 0.75, // how far its bottom sinks below its rim, as a part of discHeight
    prongLength: 95, // how far the prongs reach in front of the disc's middle
    prongWidth: 32, // how wide each prong is
    prongGap: 24, // how far apart the prongs are
    cockpitRadius: 13, // the side cockpit tube's radius
    domeSize: 30, // the turret dome's radius on top
    dishSize: 20, // the dish's radius
    glowSpread: 50, // how far around the back the engine band reaches, in degrees
    highlight: 0.3,
    bodyColor: [0.88, 0.87, 0.84],
    accentColor: [0.86, 0.22, 0.2],
    trimColor: [0.62, 0.64, 0.7],
    glassColor: [0.1, 0.14, 0.26],
    glowColor: [0.55, 0.85, 1], // the engine band
  },
  dart: {
    width: 78, // how far the back corners reach to each side
    noseLength: 115, // how far the nose reaches in front of the middle
    tailLength: 60, // how far the back corners reach behind the middle
    hullThickness: 24, // how thick the hull is; its edges are rounded
    noseStripe: 0.38, // how much of the hull from the nose back is the accent color
    canopyLength: 52,
    engineRadius: 17,
    engineLength: 95,
    finHeight: 32, // how tall the fins on the engines are
    cannonLength: 60,
    cannonRadius: 3.5,
    highlight: 0.3,
    bodyColor: [0.93, 0.92, 0.88],
    accentColor: [0.86, 0.22, 0.2],
    trimColor: [0.62, 0.64, 0.7],
    glassColor: [0.12, 0.17, 0.32],
  },
  longwing: {
    headLength: 120, // how long the cockpit pod is
    headRadius: 22, // the cockpit pod's radius
    neckLength: 34, // how far behind the cockpit pod the crossbar is
    span: 78, // how far the engines are from the middle
    barRadius: 9, // the crossbar's radius
    nacelleLength: 200, // how long the engines are
    nacelleRadius: 14, // the engines' radius
    cannonLength: 45, // how far the cannons reach in front of the cockpit pod
    cannonRadius: 3,
    highlight: 0.3,
    bodyColor: [0.93, 0.92, 0.88],
    accentColor: [0.95, 0.75, 0.2],
    trimColor: [0.62, 0.64, 0.7],
    glassColor: [0.12, 0.17, 0.32],
    droidColor: [0.95, 0.95, 0.97],
    droidAccentColor: [0.86, 0.22, 0.2],
  },
  "atomic-saucer": {
    discRadius: 95, // the disc's radius
    discHeight: 16, // how far the disc's top rises above its rim
    domeRadius: 40, // the glass dome's radius
    lights: 12, // how many lights ring the rim
    legs: 3, // how many legs it stands on; 0 for none
    legLength: 40, // how far down the legs reach below the disc
    cannonLength: 34, // how far the ray guns reach in front of the rim
    highlight: 0.4,
    bodyColor: [0.82, 0.85, 0.9],
    accentColor: [0.86, 0.22, 0.2],
    trimColor: [0.7, 0.72, 0.78],
    glassColor: [0.55, 0.8, 0.85],
    glowColor: [0.6, 1, 0.55], // every other light, the ray guns' tips and the belly ring
  },
  streamliner: {
    length: 230, // the body, from its tail to its nose
    radius: 26, // the body's radius at its widest
    canopyLength: 70,
    wingSpan: 62, // how far the wing tips reach beyond the body
    wingRoot: 74, // how long the wings are where they meet the body
    wingTip: 30, // how long the wings are at their tips
    finHeight: 56, // how tall the tail fins are
    finLength: 84, // how long the tail fins are where they meet the body
    finTilt: 18, // how far the tail fins lean outward, in degrees
    bumperRadius: 9, // the chrome bullet bumpers' radius
    highlight: 0.35,
    bodyColor: [0.96, 0.92, 0.82], // the top of the body, the fins and the canopy's surround
    accentColor: [0.86, 0.2, 0.3], // the bottom of the body and the wings
    trimColor: [0.86, 0.88, 0.92], // the chrome
    glassColor: [0.12, 0.17, 0.32],
    tailLightColor: [1, 0.28, 0.22],
  },
  seedpod: {
    length: 170, // the pod, from its back to its tip
    radius: 34, // the pod's radius at its widest
    flatten: 0.8, // how tall the pod is for how wide
    petals: 4, // how many petal wings, half on each side
    petalLength: 120,
    petalWidth: 30,
    petalCurl: -0.9, // how far the petals curl, as an angle in radians: away
    // from the pod when positive, and in toward each other behind it, like a
    // squid's, when negative
    petalSpread: 25, // how far the petals splay out from straight back, in degrees
    highlight: 0.3,
    bodyColor: [0.62, 0.76, 0.48],
    accentColor: [0.95, 0.62, 0.72], // the petals, at their bases
    petalTipColor: [1, 0.9, 0.82], // the petals, at their tips
    trimColor: [0.5, 0.62, 0.36], // the thorns and the antennae
    glassColor: [0.6, 0.85, 0.9],
    glowColor: [0.9, 1, 0.6], // the seam, the engine bulb and the antennae's tips
  },
  starcruiser: {
    saucerRadius: 72, // the saucer's radius
    saucerHeight: 12, // how far the saucer's top rises above its rim
    saucerForward: 55, // how far ahead of the middle the saucer's center is
    saucerLift: 28, // how high above the middle the saucer is
    hullDrop: 48, // how far below the saucer the hull is
    hullRadius: 19, // the hull's radius
    hullLength: 140, // how long the hull is
    nacelleSpan: 58, // how far out to each side the nacelles are
    nacelleLift: 8, // how far above the saucer the nacelles are
    nacelleLength: 140, // how long the nacelles are
    nacelleRadius: 12, // the nacelles' radius
    highlight: 0.3,
    bodyColor: [0.88, 0.89, 0.92],
    accentColor: [0.86, 0.22, 0.2], // the stripe around the saucer's rim
    trimColor: [0.62, 0.64, 0.7],
    glassColor: [0.12, 0.17, 0.32],
    glowColor: [0.45, 0.75, 1], // the deflector dish, the sensor dome and the nacelles' strips
    bussardColor: [1, 0.35, 0.25], // the nacelles' collectors and the impulse engines
  },
  "bird-of-prey": {
    headLength: 50, // how long the command head is
    headRadius: 20, // the command head's radius
    neckLength: 55, // how far the head reaches in front of the body
    bodyWidth: 60, // how wide the body is
    bodyLength: 70, // how long the body is
    wingSpan: 140, // how far the wing tips reach from the middle
    wingChord: 90, // how long the wings are where they meet the body
    wingDroop: 25, // how far the wings angle down from level, in degrees
    highlight: 0.3,
    bodyColor: [0.45, 0.55, 0.42],
    accentColor: [0.75, 0.3, 0.2], // the feather stripes, the beak and the body's spine
    trimColor: [0.4, 0.42, 0.4],
    glassColor: [0.12, 0.17, 0.2],
    glowColor: [1, 0.35, 0.2], // the engine strip and the torpedo
  },
  "battle-cruiser": {
    podRadius: 28, // the command pod's radius
    neckLength: 110, // how far the pod reaches in front of the body
    neckRadius: 9, // the neck's radius
    bodyWidth: 50, // the engine body's radius across
    bodyLength: 100, // how long the engine body is
    wingSpan: 110, // how far the nacelles are from the middle
    wingDroop: 12, // how far the wings angle down from level, in degrees
    nacelleLength: 130,
    nacelleRadius: 12,
    highlight: 0.3,
    bodyColor: [0.62, 0.66, 0.64],
    accentColor: [0.7, 0.28, 0.24], // the stripes and the pod's ring
    trimColor: [0.5, 0.52, 0.52],
    glassColor: [0.12, 0.17, 0.2],
    glowColor: [1, 0.5, 0.25], // the pod's strip, the nacelles' fronts and the tail
  },
  bumblebee: {
    abdomenLength: 110, // how long the striped abdomen is
    abdomenRadius: 38, // the abdomen's radius
    thoraxRadius: 32, // the round thorax's radius
    headRadius: 24, // the head's radius
    wingLength: 95, // how long the front wings are; the back ones are smaller
    wingWidth: 34, // how wide the front wings are
    stripes: 4, // how many dark stripes go around the abdomen
    highlight: 0.35,
    bodyColor: [0.98, 0.8, 0.15], // the abdomen's light stripes and the thorax
    accentColor: [0.12, 0.1, 0.08], // the dark stripes, the head, the legs and the stinger
    trimColor: [0.12, 0.1, 0.08],
    glassColor: [0.14, 0.12, 0.2], // the eyes
    wingColor: [0.85, 0.93, 1],
    glowColor: [1, 0.9, 0.4], // the antennae's tips
  },
  teapot: {
    bellyRadius: 55, // the teapot's radius at its widest
    bellyHeight: 40, // how far its belly reaches above and below its middle
    spoutLength: 60, // how far the spout reaches in front of the belly
    handleSize: 26, // the handle loop's radius
    plateSize: 42, // the saucer plates' radius
    plateTilt: 12, // how far the plates tilt up from level, in degrees
    dots: 20, // how many polka dots; 0 for none
    band: 1, // 1 for a band around the belly's middle, 0 for none
    cups: 1, // 1 for a cup of tea on each plate, 0 for none
    highlight: 0.4,
    bodyColor: [0.97, 0.97, 0.98], // the porcelain
    accentColor: [0.2, 0.36, 0.78], // the dots and the band
    trimColor: [0.92, 0.76, 0.32], // the gilding
    glassColor: [0.62, 0.82, 0.9], // the lid
    teaColor: [0.55, 0.32, 0.15],
  },
};

// How often each style comes up for a seed: common styles most of the time,
// and rarer ones less and less often. Each tier's weight is how often one of
// its styles comes up against the others: with the styles below, a teapot,
// the only mythic one, comes up for about 1 seed in 1,100.
const rarities = {
  "cross-wing": "common",
  "twin-panel": "common",
  dart: "common",
  longwing: "common",
  saucer: "uncommon",
  streamliner: "uncommon",
  "atomic-saucer": "rare",
  seedpod: "rare",
  starcruiser: "rare",
  "bird-of-prey": "uncommon",
  "battle-cruiser": "rare",
  bumblebee: "legendary",
  teapot: "mythic",
};
const rarityWeights = {common: 10, uncommon: 5, rare: 2, legendary: 0.5, mythic: 0.05};

// The colors random fighters pick from, by what they color.
const colors = {
  body: [
    [0.93, 0.92, 0.88],
    [0.95, 0.95, 0.96],
    [0.82, 0.84, 0.88],
    [0.96, 0.9, 0.8],
    [0.78, 0.88, 0.96],
    [0.82, 0.94, 0.86],
    [0.96, 0.84, 0.8],
    [0.88, 0.84, 0.96],
  ],
  accent: [
    [0.86, 0.22, 0.2],
    [0.95, 0.5, 0.12],
    [0.98, 0.78, 0.18],
    [0.3, 0.68, 0.3],
    [0.22, 0.48, 0.9],
    [0.6, 0.32, 0.82],
    [0.95, 0.45, 0.65],
    [0.2, 0.72, 0.72],
  ],
  trim: [
    [0.66, 0.68, 0.74],
    [0.58, 0.6, 0.66],
    [0.72, 0.7, 0.66],
    [0.6, 0.66, 0.74],
    [0.7, 0.64, 0.72],
  ],
  // Two-tone candy pairs, top and bottom, for the streamliner.
  candy: [
    [
      [0.96, 0.92, 0.82],
      [0.86, 0.2, 0.3],
    ],
    [
      [0.96, 0.92, 0.82],
      [0.4, 0.78, 0.7],
    ],
    [
      [0.98, 0.86, 0.9],
      [0.95, 0.45, 0.6],
    ],
    [
      [0.94, 0.94, 0.96],
      [0.25, 0.45, 0.85],
    ],
    [
      [0.98, 0.94, 0.7],
      [0.95, 0.55, 0.2],
    ],
    [
      [0.86, 0.94, 0.9],
      [0.2, 0.3, 0.38],
    ],
  ],
  // Seed colors, natural but soft, for the seedpod.
  seed: [
    [0.62, 0.76, 0.48],
    [0.78, 0.64, 0.46],
    [0.72, 0.66, 0.84],
    [0.56, 0.72, 0.7],
    [0.86, 0.76, 0.5],
  ],
  glow: [
    [0.55, 0.85, 1],
    [1, 0.5, 0.85],
    [0.6, 1, 0.55],
    [1, 0.7, 0.35],
    [0.75, 0.6, 1],
  ],
};

// randomParameters picks a fighter's parameters from random(), which returns
// numbers in [0, 1). Every length varies a little around its style's, so the
// fighter keeps its style's shape, its colors are picked, and so are the
// style's choices.
function randomParameters(random, styleName) {
  const between = (min, max) => min + (max - min) * random();
  const pick = (options) => options[Math.floor(random() * options.length)];

  // The style is always picked, even when it is given, so that a seed makes
  // the same fighter of a style either way. Rarer styles are picked less
  // often.
  const names = Object.keys(styles);
  const weights = names.map((key) => rarityWeights[rarities[key]]);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  const picked = names.find((key, i) => (roll -= weights[i]) < 0) || names[names.length - 1];
  const name = styleName || picked;
  const style = styles[name];

  const accentColor = pick(colors.accent);
  const [candyTop, candyBottom] = pick(colors.candy);
  const choices = {
    highlight: style.highlight,
    bodyColor: pick(colors.body),
    accentColor,
    trimColor: pick(colors.trim),
    glassColor: hsl(between(0.55, 0.75), between(0.3, 0.5), between(0.12, 0.2)),
    droidColor: pick(colors.body.slice(0, 2)),
    droidAccentColor: pick(colors.accent.filter((color) => color !== accentColor)),
    panelColor: hsl(between(0, 1), between(0.25, 0.5), between(0.16, 0.26)),
    glowColor: pick(colors.glow),
    wingAngle: between(10, 22),
    stripe: random() < 0.8 ? 1 : 0,
    windowSpokes: pick([0, 6, 8, 8]),
    panelSides: pick([6, 6, 6, 8]),
    panelSpokes: random() < 0.7 ? 1 : 0,
    noseStripe: between(0.25, 0.5),
    lights: pick([10, 12, 12, 16]),
    legs: pick([0, 3, 3, 4]),
    tailLightColor: pick([
      [1, 0.28, 0.22],
      [1, 0.6, 0.2],
      [0.6, 0.9, 1],
    ]),
    petals: pick([4, 4, 6]),
    petalCurl: between(-1.15, -0.6),
    petalTipColor: hsl(between(0.05, 0.2), between(0.5, 0.8), between(0.85, 0.93)),
  };
  if (name === "streamliner") {
    Object.assign(choices, {
      bodyColor: candyTop,
      accentColor: candyBottom,
      trimColor: style.trimColor,
    });
  } else if (name === "seedpod") {
    Object.assign(choices, {bodyColor: pick(colors.seed), glassColor: style.glassColor});
  } else if (name === "starcruiser") {
    Object.assign(choices, {
      bodyColor: pick(colors.body.slice(0, 5)),
      glowColor: pick([
        [0.45, 0.75, 1],
        [1, 0.65, 0.3],
        [0.6, 1, 0.75],
      ]),
      bussardColor: pick([
        [1, 0.35, 0.25],
        [1, 0.6, 0.2],
        [0.8, 0.4, 1],
      ]),
    });
  } else if (name === "bird-of-prey" || name === "battle-cruiser") {
    Object.assign(choices, {
      bodyColor: pick([
        [0.45, 0.55, 0.42],
        [0.52, 0.44, 0.38],
        [0.44, 0.5, 0.58],
        [0.62, 0.66, 0.64],
        [0.6, 0.38, 0.34],
      ]),
      accentColor: pick([
        [0.75, 0.3, 0.2],
        [0.85, 0.6, 0.25],
        [0.3, 0.5, 0.35],
        [0.55, 0.3, 0.55],
      ]),
      glowColor: pick([
        [1, 0.35, 0.2],
        [0.45, 1, 0.5],
        [1, 0.7, 0.3],
      ]),
      wingDroop: name === "bird-of-prey" ? between(-5, 35) : between(5, 18),
    });
  } else if (name === "bumblebee") {
    const [bodyColor, accentColor] = pick([
      [
        [0.98, 0.8, 0.15],
        [0.12, 0.1, 0.08],
      ],
      [
        [1, 0.62, 0.2],
        [0.36, 0.2, 0.12],
      ],
      [
        [0.98, 0.7, 0.8],
        [0.4, 0.18, 0.32],
      ],
      [
        [0.6, 0.92, 0.8],
        [0.14, 0.18, 0.34],
      ],
    ]);
    Object.assign(choices, {
      bodyColor,
      accentColor,
      trimColor: accentColor,
      glassColor: style.glassColor,
      wingColor: pick([
        [0.85, 0.93, 1],
        [0.95, 0.9, 1],
        [0.9, 1, 0.95],
      ]),
      stripes: pick([3, 4, 4, 5]),
    });
  } else if (name === "teapot") {
    const dots = pick([0, 16, 22, 28]);
    Object.assign(choices, {
      bodyColor: pick([
        [0.97, 0.97, 0.98],
        [0.98, 0.95, 0.88],
        [0.86, 0.92, 0.98],
        [0.98, 0.88, 0.9],
        [0.86, 0.96, 0.9],
      ]),
      accentColor: pick([
        [0.2, 0.36, 0.78],
        [0.86, 0.36, 0.5],
        [0.36, 0.6, 0.4],
        [0.56, 0.42, 0.78],
        [0.9, 0.55, 0.2],
      ]),
      trimColor: style.trimColor,
      glassColor: style.glassColor,
      teaColor: pick([
        [0.55, 0.32, 0.15],
        [0.55, 0.65, 0.25],
        [0.85, 0.45, 0.5],
        [0.42, 0.3, 0.22],
      ]),
      dots,
      band: dots === 0 || random() < 0.5 ? 1 : 0,
      cups: pick([0, 1, 1]),
    });
  } else if (name === "atomic-saucer") {
    choices.glassColor = hsl(between(0.45, 0.6), between(0.35, 0.55), between(0.6, 0.72));
  }

  const parameters = {};
  for (const [key, value] of Object.entries(style)) {
    parameters[key] = key in choices ? choices[key] : value * between(0.9, 1.1);
  }
  return {style: name, parameters};
}

// The way highlights face: up, and a little to the left and front, the way
// cartoons are usually lit.
const HIGHLIGHT = normalize([-0.45, 0.8, 0.4]);
const HIGHLIGHT_SIZE = 0.3; // how much of a rounded part its highlight covers

const darkColors = {
  intake: [0.08, 0.09, 0.12],
  exhaust: [0.06, 0.06, 0.08],
};

// mulberry32 is a small seeded random number generator, so a seed always
// makes the same fighter. The seed is scrambled first, since nearby seeds
// like 1, 2 and 3 otherwise start with similar numbers.
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

// highlight gives the vertices added since start a cartoon highlight: the ones
// whose normals face the highlight are lightened toward a warm white, with a
// sharp edge, so rounded parts look glossy rather than shaded.
function highlight(mesh, start, amount) {
  for (let i = start; i < mesh.vertices.length; i++) {
    const vertex = mesh.vertices[i];
    if (amount > 0 && dot(vertex.normal, HIGHLIGHT) > 1 - HIGHLIGHT_SIZE) {
      vertex.color = vertex.color.map((v, c) => v + ([1, 1, 0.85][c] - v) * amount);
    }
  }
}

// basisFor is three directions at right angles, with w along direction, for
// orient to stand a part along it.
function basisFor(direction) {
  const w = normalize(direction);
  const reference = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(reference, w));
  return [u, cross(w, u), w];
}

// orient turns the vertices added since start from their own X, Y and Z axes
// to u, v and w, then moves them to origin. Parts are built along Z, which
// lathe spins around, and stood up where they go with this.
function orient(mesh, start, [u, v, w], origin = [0, 0, 0]) {
  const turn = ([x, y, z]) => add(add(scale(u, x), scale(v, y)), scale(w, z));
  for (let i = start; i < mesh.vertices.length; i++) {
    const vertex = mesh.vertices[i];
    vertex.position = add(turn(vertex.position), origin);
    vertex.normal = turn(vertex.normal);
  }
}

// capsule is the lathe profile of a capsule along Z, from back to front,
// radius wide, with rounded ends, colored by color(end, z), where end is how
// far around the end caps the point is: -1 at the back tip, 0 along the
// sides, and 1 at the front tip.
function capsule(back, front, radius, color, steps = 10) {
  const profile = [];
  for (const [from, to, center] of [
    [-1, 0, back + radius],
    [0, 1, front - radius],
  ]) {
    for (let i = 0; i <= steps; i++) {
      const a = (Math.PI / 2) * (from + (to - from) * (i / steps));
      const z = center + radius * Math.sin(a);
      profile.push({
        r: radius * Math.cos(a),
        z,
        normal: [Math.cos(a), Math.sin(a)],
        color: color(Math.sin(a), z),
      });
    }
  }
  return profile;
}

// pod adds a capsule along Z from back to front, centered on at, with a
// highlight, colored by color(end, z) as capsule describes.
function pod(mesh, at, back, front, radius, color, amount, sides = 32) {
  const start = mesh.vertices.length;
  lathe(mesh, capsule(back, front, radius, color), sides);
  mesh.translate(start, at);
  highlight(mesh, start, amount);
}

// rod adds a rod from a to b, radius wide, in one color, with its round ends
// centered on a and b, so that rods joined end to end, such as along a
// curve, run smoothly through their joints.
function rod(mesh, a, b, radius, color, amount, sides = 16) {
  const start = mesh.vertices.length;
  const length = Math.hypot(...sub(b, a));
  lathe(
    mesh,
    capsule(-radius, length + radius, radius, () => color, 4),
    sides
  );
  orient(mesh, start, basisFor(sub(b, a)), a);
  highlight(mesh, start, amount);
}

// ellipsoid adds an ellipsoid at center, radius wide and length long, with
// its length along w of basis, which is along Z by default.
function ellipsoid(mesh, center, radius, length, color, amount, sides = 32, basis = null) {
  const rings = Math.max(8, Math.round(sides * 0.6));
  const points = Array.from({length: rings + 1}, (_, i) => {
    const a = Math.PI * (i / rings - 0.5);
    return {
      r: radius * Math.cos(a),
      z: length * Math.sin(a),
      normal: [Math.cos(a) / radius, Math.sin(a) / length],
      color,
    };
  });
  const start = mesh.vertices.length;
  lathe(mesh, points, sides);
  orient(mesh, start, basis || basisFor([0, 0, 1]), center);
  highlight(mesh, start, amount);
}

// torus adds a ring around the Z axis, ringRadius wide at z, made of a tube
// tube wide, then turned to basis and moved to origin, as orient does.
function torus(
  mesh,
  ringRadius,
  z,
  tube,
  color,
  amount,
  sides = 40,
  basis = null,
  origin = [0, 0, 0]
) {
  const steps = 12;
  const points = Array.from({length: steps + 1}, (_, i) => {
    const b = (i / steps) * 2 * Math.PI;
    return {
      r: ringRadius + tube * Math.cos(b),
      z: z + tube * Math.sin(b),
      normal: [Math.cos(b), Math.sin(b)],
      color,
    };
  });
  const start = mesh.vertices.length;
  lathe(mesh, points, sides);
  orient(mesh, start, basis || basisFor([0, 0, 1]), origin);
  highlight(mesh, start, amount);
}

// squash scales the vertices added since start by factors along X, Y and Z,
// keeping their normals at right angles to the scaled surface.
function squash(mesh, start, factors) {
  for (let i = start; i < mesh.vertices.length; i++) {
    const vertex = mesh.vertices[i];
    vertex.position = vertex.position.map((v, axis) => v * factors[axis]);
    vertex.normal = normalize(vertex.normal.map((v, axis) => v / factors[axis]));
  }
}

// bend curls the vertices added since start, which run from 0 to length
// along Z, around an arc toward +Y, turning by curl radians over their
// length, the way a petal or a leaf curls.
function bend(mesh, start, length, curl) {
  if (!curl) {
    return;
  }
  const arc = length / curl;
  for (let i = start; i < mesh.vertices.length; i++) {
    const vertex = mesh.vertices[i];
    const [x, y, z] = vertex.position;
    const [nx, ny, nz] = vertex.normal;
    const theta = z / arc;
    const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
    vertex.position = [x, arc - (arc - y) * cos, (arc - y) * sin];
    vertex.normal = [nx, ny * cos + nz * sin, -ny * sin + nz * cos];
  }
}

// smooth rounds off a closed polygon's corners by cutting each one, again and
// again, so that it comes out as a smooth curve through its sides.
function smooth(points, iterations = 3) {
  let result = points;
  for (let n = 0; n < iterations; n++) {
    result = result.flatMap((p, i) => {
      const q = result[(i + 1) % result.length];
      return [
        [0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]],
        [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]],
      ];
    });
  }
  return result;
}

// regular is a regular polygon of sides corners, radius from its middle to
// each, with a corner straight up along y.
const regular = (sides, radius) =>
  Array.from({length: sides}, (_, i) => {
    const a = (i / sides) * 2 * Math.PI;
    return [radius * Math.sin(a), radius * Math.cos(a)];
  });

// slab adds a flat, puffy panel, such as a wing: outline, a polygon in the
// plane of u and v from origin that every point of can be seen from its
// middle, given thickness, with its edges rounded over like a pillow's. w is
// the side its top faces.
function slab(mesh, outline, thickness, origin, [u, v, w], color, rounding = 6) {
  const r = thickness / 2;
  const n = outline.length;
  const centroid = outline
    .reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map((value) => value / n);
  const at = ([x, y], lift) => add(add(add(origin, scale(u, x)), scale(v, y)), scale(w, lift));

  // Each point's outward direction in the plane, and where it is pulled in
  // to, so that the rounded edge bulges back out to the outline.
  const outward = outline.map((point, i) => {
    const [prev, next] = [outline[(i + n - 1) % n], outline[(i + 1) % n]];
    let [x, y] = [next[1] - prev[1], prev[0] - next[0]];
    const length = Math.hypot(x, y);
    [x, y] = [x / length, y / length];
    return (point[0] - centroid[0]) * x + (point[1] - centroid[1]) * y < 0 ? [-x, -y] : [x, y];
  });
  const inset = outline.map((point, i) => [
    point[0] - outward[i][0] * r,
    point[1] - outward[i][1] * r,
  ]);

  // The rounded edge, from the bottom face around to the top face.
  const rings = [];
  for (let k = 0; k <= rounding; k++) {
    const theta = Math.PI * (k / rounding - 0.5);
    const [out, up] = [Math.cos(theta), Math.sin(theta)];
    rings.push(
      inset.map((point, i) => {
        const [x, y] = outward[i];
        const normal = add(add(scale(u, x * out), scale(v, y * out)), scale(w, up));
        return mesh.vertex(
          at([point[0] + x * r * out, point[1] + y * r * out], r * up),
          normal,
          color
        );
      })
    );
  }
  for (let k = 0; k < rounding; k++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      mesh.quad(rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]);
    }
  }

  // The flat faces.
  for (const side of [1, -1]) {
    const middle = mesh.vertex(at(centroid, side * r), scale(w, side), color);
    const ring = inset.map((point) => mesh.vertex(at(point, side * r), scale(w, side), color));
    for (let i = 0; i < n; i++) {
      mesh.triangle(middle, ring[i], ring[(i + 1) % n]);
    }
  }
}

// engineColor colors an engine pod: a dark intake at its front and a dark
// exhaust at its back.
const engineColor = (color) => (end) =>
  end > 0.6 ? darkColors.intake : end < -0.6 ? darkColors.exhaust : color;

// muzzle adds a cannon's round muzzle at its tip, dark at its very front.
function muzzle(mesh, tip, radius, p) {
  pod(
    mesh,
    tip,
    -radius * 2.5,
    1,
    radius,
    (end) => (end > 0.7 ? darkColors.intake : p.trimColor),
    p.highlight,
    20
  );
}

// buildCrossWing builds a cross-wing: see the styles at the top.
function buildCrossWing(p, mesh, exhausts, cannons) {
  // The fuselage: a rounded tail, a long middle, and a taper to a rounded
  // nose, with two bands of the accent color around the nose.
  const tail = -p.length * 0.42;
  const nose = p.length * 0.58;
  const backCap = p.radius * 1.3;
  const noseCap = p.noseRadius * 1.6;
  const fuselageRadius = (z) => {
    if (z < tail + backCap) {
      return p.radius * Math.sqrt(Math.max(0, 1 - ((z - tail - backCap) / backCap) ** 2));
    }
    if (z < 0) {
      return p.radius;
    }
    if (z < nose - noseCap) {
      const t = z / (nose - noseCap);
      return p.radius + (p.noseRadius - p.radius) * t * t * (3 - 2 * t);
    }
    return p.noseRadius * Math.sqrt(Math.max(0, 1 - ((z - nose + noseCap) / noseCap) ** 2));
  };
  const bands = [
    [0.68, 0.72],
    [0.76, 0.78],
  ].map(([from, to]) => [from * nose, to * nose]);
  const steps = 160;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const z = tail + ((nose - tail) * (1 - Math.cos((i / steps) * Math.PI))) / 2;
    const banded = bands.some(([from, to]) => z > from && z < to);
    return {r: fuselageRadius(z), z, color: banded ? p.accentColor : p.bodyColor};
  });
  profile[0] = {...profile[0], r: 0, normal: [0, -1]};
  profile[steps] = {...profile[steps], r: 0, normal: [0, 1]};
  const start = mesh.vertices.length;
  lathe(mesh, profile, 48);
  highlight(mesh, start, p.highlight);

  // The bubble canopy sits on top of the fuselage, ahead of its middle, and
  // the droid's dome behind it.
  const glossy = p.highlight * 1.3;
  ellipsoid(
    mesh,
    [0, p.radius * 0.62, p.canopyLength * 0.15],
    p.radius * 0.62,
    p.canopyLength / 2,
    p.glassColor,
    glossy
  );
  const dome = p.radius * 0.45;
  const domeAt = [0, p.radius * 0.78, -p.canopyLength * 0.55];
  ellipsoid(mesh, domeAt, dome, dome, p.droidColor, glossy, 24);
  ellipsoid(
    mesh,
    add(domeAt, [0, dome * 0.75, 0]),
    dome * 0.55,
    dome * 0.55,
    p.droidAccentColor,
    glossy,
    16
  );
  ellipsoid(
    mesh,
    add(domeAt, [0, dome * 0.35, dome * 0.85]),
    dome * 0.22,
    dome * 0.22,
    darkColors.intake,
    glossy,
    12
  );

  // The wings spread in an X. Each lies in the plane through the fuselage's
  // axis turned wingAngle up or down from level, reaching out along u, with
  // v along the fuselage.
  const tilt = (p.wingAngle * Math.PI) / 180;
  const rootBack = tail + backCap * 0.6;
  const tipBack = rootBack + p.wingRoot * 0.15;
  const wingOutline = (from, to) => {
    // The wing between from and to of its span: its trailing edge runs from
    // rootBack to tipBack and its leading edge from the root's front to the
    // tip's front.
    const back = (s) => rootBack + (tipBack - rootBack) * s;
    const front = (s) => rootBack + p.wingRoot + (tipBack + p.wingTip - rootBack - p.wingRoot) * s;
    const span = (s) => p.radius * 0.5 + (p.wingSpan - p.radius * 0.5) * s;
    return [
      [span(from), back(from)],
      [span(to), back(to)],
      [span(to), front(to)],
      [span(from), front(from)],
    ];
  };
  for (const angle of [tilt, Math.PI - tilt, Math.PI + tilt, -tilt]) {
    const u = [Math.cos(angle), Math.sin(angle), 0];
    const v = [0, 0, 1];
    const w = cross(u, v);
    const top = w[1] < 0 ? scale(w, -1) : w;
    slab(mesh, smooth(wingOutline(0, 1)), p.wingThickness, [0, 0, 0], [u, v, top], p.bodyColor);
    if (p.stripe) {
      slab(
        mesh,
        smooth(wingOutline(0.62, 0.78), 2),
        p.wingThickness + 1.2,
        [0, 0, 0],
        [u, v, top],
        p.accentColor,
        4
      );
    }

    // The engine pod at the wing's root.
    const podAt = scale(u, p.radius + p.engineRadius * 0.6);
    const podBack = rootBack - p.engineRadius * 0.6;
    pod(
      mesh,
      podAt,
      podBack,
      podBack + p.engineLength,
      p.engineRadius,
      engineColor(p.trimColor),
      p.highlight
    );
    exhausts.push({position: add(podAt, [0, 0, podBack]), radius: p.engineRadius * 0.55});

    // The cannon along the wing's tip: a bulb where it meets the wing, a
    // ring along it, and a round muzzle at its front.
    const cannonAt = scale(u, p.wingSpan + p.cannonRadius);
    const cannonBack = tipBack - 6;
    const cannonFront = cannonBack + p.cannonLength;
    const trim = () => p.trimColor;
    pod(mesh, cannonAt, cannonBack, cannonFront, p.cannonRadius, trim, p.highlight, 16);
    pod(
      mesh,
      cannonAt,
      cannonBack,
      cannonBack + p.wingTip * 0.9,
      p.cannonRadius * 2.2,
      trim,
      p.highlight,
      24
    );
    const ringAt = cannonBack + p.cannonLength * 0.6;
    pod(
      mesh,
      cannonAt,
      ringAt,
      ringAt + 8,
      p.cannonRadius * 1.6,
      () => p.accentColor,
      p.highlight,
      20
    );
    muzzle(mesh, add(cannonAt, [0, 0, cannonFront]), p.cannonRadius * 2, p);
    cannons.push({position: add(cannonAt, [0, 0, cannonFront + 1]), direction: [0, 0, 1]});
  }
}

// buildTwinPanel builds a twin-panel: see the styles at the top.
function buildTwinPanel(p, mesh, exhausts, cannons) {
  const radius = p.ballRadius;
  const glossy = p.highlight * 1.3;
  ellipsoid(mesh, [0, 0, 0], radius, radius, p.bodyColor, p.highlight, 40);

  // The window is a cap of glass over the ball's front, inside a raised
  // frame, with spokes across it from its middle to its frame.
  const edge = Math.asin(Math.min(0.95, p.windowSize));
  const onBall = (lift, a) => ({
    r: (radius + lift) * Math.sin(a),
    z: (radius + lift) * Math.cos(a),
    normal: [Math.sin(a), Math.cos(a)],
  });
  let start = mesh.vertices.length;
  lathe(
    mesh,
    Array.from({length: 13}, (_, i) => ({
      ...onBall(0.8, edge * (1 - i / 12)),
      color: p.glassColor,
    })),
    40
  );
  highlight(mesh, start, glossy);
  torus(mesh, radius * Math.sin(edge), radius * Math.cos(edge), 3.2, p.trimColor, p.highlight);
  for (let k = 0; k < p.windowSpokes; k++) {
    const around = (k / p.windowSpokes) * 2 * Math.PI;
    const point = (a) => {
      const {r, z} = onBall(1.4, a);
      return [r * Math.cos(around), r * Math.sin(around), z];
    };
    for (let i = 0; i < 3; i++) {
      rod(mesh, point((edge * i) / 3), point((edge * (i + 1)) / 3), 1.4, p.trimColor, 0, 8);
    }
  }

  // An arm out of each side of the ball, with a bulb at its middle, holds a
  // panel: a dark face inside a light rim, with spokes from its middle to
  // its corners on both sides.
  for (const side of [1, -1]) {
    const reach = radius + p.armLength;
    rod(
      mesh,
      [side * radius * 0.7, 0, 0],
      [side * reach, 0, 0],
      p.armRadius,
      p.trimColor,
      p.highlight
    );
    ellipsoid(
      mesh,
      [side * (radius + p.armLength * 0.3), 0, 0],
      p.armRadius * 1.7,
      p.armRadius * 1.7,
      p.bodyColor,
      p.highlight,
      20
    );

    const basis = [
      [0, 1, 0],
      [0, 0, 1],
      [side, 0, 0],
    ];
    const corners = regular(p.panelSides, p.panelSize);
    slab(
      mesh,
      smooth(regular(p.panelSides, p.panelSize + 6), 2),
      p.panelThickness * 0.7,
      [side * reach, 0, 0],
      basis,
      p.trimColor,
      4
    );
    slab(mesh, smooth(corners, 2), p.panelThickness, [side * reach, 0, 0], basis, p.panelColor, 4);
    for (const face of [1, -1]) {
      const x = side * reach + face * (p.panelThickness / 2 + 0.6);
      ellipsoid(mesh, [x, 0, 0], 9, 9, p.trimColor, p.highlight, 16);
      if (p.panelSpokes) {
        for (const [y, z] of corners) {
          rod(mesh, [x, 0, 0], [x, y * 0.92, z * 0.92], 2.2, p.trimColor, 0, 8);
        }
      }
    }
  }

  // Two cannons under the window, and two small engines at the back.
  for (const side of [1, -1]) {
    const x = side * radius * 0.3;
    const y = -radius * 0.55;
    const front = radius * 0.78 + p.cannonLength;
    rod(mesh, [x, y, radius * 0.6], [x, y, front], p.cannonRadius, p.trimColor, p.highlight, 12);
    muzzle(mesh, [x, y, front], p.cannonRadius * 1.6, p);
    cannons.push({position: [x, y, front + 1], direction: [0, 0, 1]});

    const back = -radius - 8;
    pod(
      mesh,
      [side * radius * 0.35, 0, 0],
      back,
      -radius * 0.6,
      9,
      engineColor(p.trimColor),
      p.highlight,
      20
    );
    exhausts.push({position: [side * radius * 0.35, 0, back], radius: 5});
  }
}

// buildSaucer builds a saucer: see the styles at the top.
function buildSaucer(p, mesh, exhausts, cannons) {
  const radius = p.discRadius;
  const height = p.discHeight;
  const up = [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ];

  // The disc is spun around Z, then stood up. Its rim is rounded rather than
  // sharp, and a stripe of the accent color rings its top.
  const steps = 60;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const a = Math.PI * (i / steps - 0.5);
    const r = radius * Math.cos(a) ** 0.55;
    const striped = a > 0 && r > radius * 0.55 && r < radius * 0.63;
    return {
      r,
      z: (a > 0 ? height : height * p.belly) * Math.sin(a),
      color: striped ? p.accentColor : p.bodyColor,
    };
  });
  profile[0] = {...profile[0], r: 0, normal: [0, -1]};
  profile[steps] = {...profile[steps], r: 0, normal: [0, 1]};
  const start = mesh.vertices.length;
  lathe(mesh, profile, 64);
  orient(mesh, start, up);
  highlight(mesh, start, p.highlight);

  // A dome on top with a glass turret, and a dish on a short stalk.
  const glossy = p.highlight * 1.3;
  ellipsoid(
    mesh,
    [0, height * 0.8, -radius * 0.1],
    p.domeSize,
    p.domeSize * 0.8,
    p.bodyColor,
    p.highlight,
    32,
    up
  );
  ellipsoid(
    mesh,
    [0, height * 0.8 + p.domeSize * 0.75, -radius * 0.1],
    p.domeSize * 0.38,
    p.domeSize * 0.38,
    p.glassColor,
    glossy,
    20
  );
  const dishAt = [-radius * 0.45, height * 0.75, radius * 0.1];
  rod(mesh, dishAt, add(dishAt, [0, 10, 0]), 2.5, p.trimColor, 0, 8);
  ellipsoid(
    mesh,
    add(dishAt, [0, 12, 0]),
    p.dishSize,
    3,
    p.trimColor,
    p.highlight,
    24,
    basisFor([0, 1, 0.5])
  );
  ellipsoid(mesh, add(dishAt, [0, 15, 1.5]), 3.5, 3.5, p.accentColor, glossy, 12);

  // Two prongs reach forward, with a cannon on each tip.
  const prongStart = radius * 0.5;
  const prongTip = prongStart + p.prongLength;
  for (const side of [1, -1]) {
    const [inner, outer] = [side * (p.prongGap / 2), side * (p.prongGap / 2 + p.prongWidth)];
    slab(
      mesh,
      smooth([
        [inner, prongStart],
        [outer, prongStart],
        [outer, prongTip],
        [inner, prongTip],
      ]),
      height * 1.1,
      [0, 0, 0],
      [
        [1, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
      ],
      p.bodyColor,
      6
    );
    const x = (inner + outer) / 2;
    rod(mesh, [x, 0, prongTip - 10], [x, 0, prongTip + 14], 3.5, p.trimColor, p.highlight, 12);
    muzzle(mesh, [x, 0, prongTip + 14], 5.5, p);
    cannons.push({position: [x, 0, prongTip + 15], direction: [0, 0, 1]});
  }

  // The cockpit is a tube out of the right side, reaching forward, with a
  // glass bubble at its end.
  const tubeStart = [radius * 0.7, 0, radius * 0.05];
  const tubeEnd = [radius * 1.02, 0, radius * 0.5];
  rod(mesh, tubeStart, tubeEnd, p.cockpitRadius, p.bodyColor, p.highlight, 24);
  const direction = normalize(sub(tubeEnd, tubeStart));
  ellipsoid(
    mesh,
    add(tubeEnd, scale(direction, p.cockpitRadius * 0.4)),
    p.cockpitRadius * 0.95,
    p.cockpitRadius * 1.2,
    p.glassColor,
    glossy,
    24,
    basisFor(direction)
  );

  // The engine band glows across the back of the rim, and flames come out
  // of its middle and both ends.
  const spread = (p.glowSpread * Math.PI) / 180;
  const onRim = (a, r) => [r * Math.sin(Math.PI + a), 0, r * Math.cos(Math.PI + a)];
  const pieces = 12;
  for (let i = 0; i < pieces; i++) {
    const [a, b] = [-spread + (2 * spread * i) / pieces, -spread + (2 * spread * (i + 1)) / pieces];
    rod(mesh, onRim(a, radius * 0.97), onRim(b, radius * 0.97), height * 0.32, p.glowColor, 0, 12);
  }
  for (const a of [-spread * 0.6, 0, spread * 0.6]) {
    exhausts.push({position: onRim(a, radius * 1.02), radius: height * 0.3});
  }
}

// buildDart builds a dart: see the styles at the top.
function buildDart(p, mesh, exhausts, cannons) {
  const flat = [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ];
  const nose = [0, p.noseLength];
  const right = [p.width, -p.tailLength];
  const left = [-p.width, -p.tailLength];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  // The hull is a puffy arrowhead, notched a little at its back, with its
  // nose in the accent color.
  slab(
    mesh,
    smooth([nose, right, [0, -p.tailLength * 0.7], left]),
    p.hullThickness,
    [0, 0, 0],
    flat,
    p.bodyColor,
    8
  );
  slab(
    mesh,
    smooth([nose, lerp(nose, right, p.noseStripe), lerp(nose, left, p.noseStripe)], 2),
    p.hullThickness + 1.5,
    [0, 0, 0],
    flat,
    p.accentColor,
    6
  );
  ellipsoid(
    mesh,
    [0, p.hullThickness / 2, p.noseLength * 0.05],
    p.hullThickness * 0.62,
    p.canopyLength / 2,
    p.glassColor,
    p.highlight * 1.3
  );

  // An engine pod at each back corner, with a fin on top, and a cannon
  // along its outside.
  for (const side of [1, -1]) {
    const x = side * p.width * 0.82;
    const back = -p.tailLength - p.engineLength * 0.35;
    const front = back + p.engineLength;
    pod(mesh, [x, 0, 0], back, front, p.engineRadius, engineColor(p.trimColor), p.highlight);
    exhausts.push({position: [x, 0, back], radius: p.engineRadius * 0.55});

    slab(
      mesh,
      smooth(
        [
          [p.engineRadius * 0.5, back + 12],
          [p.engineRadius * 0.5, back + 50],
          [p.engineRadius + p.finHeight, back + 22],
          [p.engineRadius + p.finHeight, back + 8],
        ],
        2
      ),
      6,
      [x, 0, 0],
      [
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 0],
      ],
      p.accentColor,
      4
    );

    const cannonX = x + side * (p.engineRadius + p.cannonRadius + 2);
    const cannonBack = back + p.engineLength * 0.4;
    const cannonFront = cannonBack + p.cannonLength;
    rod(
      mesh,
      [cannonX, 0, cannonBack],
      [cannonX, 0, cannonFront],
      p.cannonRadius,
      p.trimColor,
      p.highlight,
      12
    );
    muzzle(mesh, [cannonX, 0, cannonFront], p.cannonRadius * 1.6, p);
    cannons.push({position: [cannonX, 0, cannonFront + 1], direction: [0, 0, 1]});
  }
}

// buildLongwing builds a longwing: see the styles at the top.
function buildLongwing(p, mesh, exhausts, cannons) {
  const glossy = p.highlight * 1.3;

  // The cockpit pod, with bands of the accent color around its nose and a
  // glass canopy on top.
  const bands = [
    [0.72, 0.78],
    [0.82, 0.85],
  ].map(([from, to]) => [from * p.headLength, to * p.headLength]);
  pod(
    mesh,
    [0, 0, 0],
    0,
    p.headLength,
    p.headRadius,
    (end, z) => (bands.some(([from, to]) => z > from && z < to) ? p.accentColor : p.bodyColor),
    p.highlight,
    40
  );
  ellipsoid(
    mesh,
    [0, p.headRadius * 0.7, p.headLength * 0.55],
    p.headRadius * 0.55,
    p.headLength * 0.2,
    p.glassColor,
    glossy
  );

  // A neck back to the droid's body, with its dome on top, and the crossbar
  // through it.
  const body = -p.neckLength;
  rod(mesh, [0, 0, 0], [0, 0, body], p.headRadius * 0.55, p.trimColor, p.highlight);
  ellipsoid(mesh, [0, 0, body], p.headRadius * 1.15, p.headRadius, p.bodyColor, p.highlight);
  const dome = p.headRadius * 0.45;
  ellipsoid(mesh, [0, p.headRadius * 0.95, body], dome, dome, p.droidColor, glossy, 24);
  ellipsoid(
    mesh,
    [0, p.headRadius * 0.95 + dome * 0.75, body],
    dome * 0.55,
    dome * 0.55,
    p.droidAccentColor,
    glossy,
    16
  );
  rod(mesh, [-p.span, 0, body], [p.span, 0, body], p.barRadius, p.trimColor, p.highlight, 20);

  // The engines, each with a big round intake at its front.
  for (const side of [1, -1]) {
    const x = side * p.span;
    const back = body - p.nacelleLength * 0.72;
    const front = body + p.nacelleLength * 0.28;
    pod(mesh, [x, 0, 0], back, front, p.nacelleRadius, engineColor(p.bodyColor), p.highlight);
    ellipsoid(
      mesh,
      [x, 0, front],
      p.nacelleRadius * 1.3,
      p.nacelleRadius * 1.1,
      p.accentColor,
      glossy,
      28
    );
    ellipsoid(
      mesh,
      [x, 0, front + p.nacelleRadius * 0.6],
      p.nacelleRadius * 0.8,
      p.nacelleRadius * 0.6,
      darkColors.intake,
      0,
      20
    );
    exhausts.push({position: [x, 0, back], radius: p.nacelleRadius * 0.55});
  }

  // Two cannons under the cockpit pod's nose.
  for (const side of [1, -1]) {
    const [x, y] = [side * p.headRadius * 0.45, -p.headRadius * 0.65];
    const front = p.headLength + p.cannonLength;
    rod(
      mesh,
      [x, y, p.headLength * 0.7],
      [x, y, front],
      p.cannonRadius,
      p.trimColor,
      p.highlight,
      12
    );
    muzzle(mesh, [x, y, front], p.cannonRadius * 1.6, p);
    cannons.push({position: [x, y, front + 1], direction: [0, 0, 1]});
  }
}

// buildAtomicSaucer builds an atomic-saucer: see the styles at the top.
function buildAtomicSaucer(p, mesh, exhausts, cannons) {
  const radius = p.discRadius;
  const height = p.discHeight;
  const up = [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ];
  const glossy = p.highlight * 1.3;
  const around = (angle, r, y) => [r * Math.sin(angle), y, r * Math.cos(angle)];

  // The disc, spun around Z and stood up, flatter than the saucer's, with a
  // rounded lip around its rim and a bulge underneath ringed with light.
  const steps = 60;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const a = Math.PI * (i / steps - 0.5);
    return {
      r: radius * Math.cos(a) ** 0.45,
      z: (a > 0 ? height : height * 0.6) * Math.sin(a),
      color: p.bodyColor,
    };
  });
  profile[0] = {...profile[0], r: 0, normal: [0, -1]};
  profile[steps] = {...profile[steps], r: 0, normal: [0, 1]};
  const start = mesh.vertices.length;
  lathe(mesh, profile, 64);
  orient(mesh, start, up);
  highlight(mesh, start, p.highlight);
  torus(mesh, radius * 0.97, 0, 5, p.trimColor, p.highlight, 64, up);
  ellipsoid(
    mesh,
    [0, -height * 0.45, 0],
    radius * 0.35,
    height * 0.9,
    p.trimColor,
    p.highlight,
    40,
    up
  );
  torus(mesh, radius * 0.24, 0, 2.5, p.glowColor, 0, 32, up, [0, -height * 1.25, 0]);

  // The glass dome, on a collar, with an antenna on top.
  ellipsoid(
    mesh,
    [0, height * 0.6, 0],
    p.domeRadius,
    p.domeRadius * 0.9,
    p.glassColor,
    glossy,
    40,
    up
  );
  torus(mesh, p.domeRadius, 0, 4, p.accentColor, p.highlight, 48, up, [0, height * 0.65, 0]);
  const antennaBase = [0, height * 0.6 + p.domeRadius * 0.85, 0];
  rod(mesh, antennaBase, add(antennaBase, [0, 18, 0]), 1.5, p.trimColor, 0, 8);
  ellipsoid(mesh, add(antennaBase, [0, 21, 0]), 4, 4, p.glowColor, glossy, 12);

  // Lights all around the rim, alternating between the glow and the accent
  // colors.
  for (let i = 0; i < p.lights; i++) {
    const angle = (i / p.lights) * 2 * Math.PI;
    const color = i % 2 ? p.accentColor : p.glowColor;
    ellipsoid(mesh, around(angle, radius * 0.97, 0), 5.5, 5.5, color, glossy, 12);
  }

  // Legs angled out under the disc, each on a ball foot.
  for (let i = 0; i < p.legs; i++) {
    const angle = Math.PI + (i / p.legs) * 2 * Math.PI + Math.PI / p.legs;
    const top = around(angle, radius * 0.3, -height * 0.4);
    const foot = around(angle, radius * 0.62, -height * 0.4 - p.legLength);
    rod(mesh, top, foot, 3, p.trimColor, p.highlight, 10);
    ellipsoid(mesh, foot, 7, 7, p.accentColor, glossy, 14);
  }

  // Two ray guns on the front of the rim: stacked rings along a barrel,
  // with a glowing ball at the tip.
  for (const side of [1, -1]) {
    const [x, y] = [side * radius * 0.25, -2];
    const back = radius * 0.82;
    const tip = back + p.cannonLength;
    rod(mesh, [x, y, back], [x, y, tip], 3, p.trimColor, p.highlight, 12);
    for (let i = 0; i < 3; i++) {
      const z = back + p.cannonLength * (0.35 + 0.2 * i);
      torus(mesh, 4.5 - i * 0.6, z, 1.6, p.accentColor, p.highlight, 16, null, [x, y, 0]);
    }
    ellipsoid(mesh, [x, y, tip], 4.5, 4.5, p.glowColor, glossy, 12);
    cannons.push({position: [x, y, tip + 5], direction: [0, 0, 1]});
  }

  // Two small jets at the back of the rim.
  for (const side of [1, -1]) {
    const x = side * radius * 0.3;
    pod(
      mesh,
      [x, 0, 0],
      -radius * 1.0,
      -radius * 0.75,
      7,
      engineColor(p.trimColor),
      p.highlight,
      20
    );
    exhausts.push({position: [x, 0, -radius], radius: 4});
  }
}

// buildStreamliner builds a streamliner: see the styles at the top.
function buildStreamliner(p, mesh, exhausts, cannons) {
  const tail = -p.length * 0.45;
  const nose = p.length * 0.55;
  const span = nose - tail;
  const glossy = p.highlight * 1.3;
  const flat = [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ];

  // The body is a teardrop, narrow at its tail and round at its nose. Its
  // top and bottom are its two colors, split a little below its middle.
  const bodyRadius = (z) => {
    const u = (z - tail) / span;
    if (u < 0.85) {
      const t = Math.min(1, u / 0.6);
      return p.radius * (0.38 + 0.62 * t * t * (3 - 2 * t));
    }
    return p.radius * Math.sqrt(Math.max(0, 1 - ((u - 0.85) / 0.15) ** 2));
  };
  const steps = 120;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const z = tail + (span * i) / steps;
    return {r: bodyRadius(z), z, color: p.bodyColor};
  });
  profile[steps] = {...profile[steps], r: 0, normal: [0, 1]};
  const start = mesh.vertices.length;
  lathe(mesh, profile, 48);
  const split = -p.radius * 0.1;
  for (let i = start; i < mesh.vertices.length; i++) {
    mesh.vertices[i].color = mesh.vertices[i].position[1] > split ? p.bodyColor : p.accentColor;
  }
  highlight(mesh, start, p.highlight);

  // A chrome spear runs along each side where the colors meet.
  for (const side of [1, -1]) {
    const point = (u) => {
      const z = tail + span * u;
      const r = bodyRadius(z);
      return [side * Math.sqrt(Math.max(0, r * r - split * split)) + side * 0.6, split, z];
    };
    for (let i = 0; i < 12; i++) {
      rod(
        mesh,
        point(0.1 + (0.78 * i) / 12),
        point(0.1 + (0.78 * (i + 1)) / 12),
        2,
        p.trimColor,
        p.highlight,
        8
      );
    }
  }

  // The bubble canopy, ahead of the middle.
  ellipsoid(
    mesh,
    [0, p.radius * 0.7, nose - span * 0.42],
    p.radius * 0.6,
    p.canopyLength / 2,
    p.glassColor,
    glossy
  );

  // Short swept wings, low on the sides.
  for (const side of [1, -1]) {
    const rootX = side * p.radius * 0.7;
    const tipX = side * (p.radius + p.wingSpan);
    const rootBack = tail + span * 0.3;
    const tipBack = rootBack - 18;
    slab(
      mesh,
      smooth([
        [rootX, rootBack],
        [tipX, tipBack],
        [tipX, tipBack + p.wingTip],
        [rootX, rootBack + p.wingRoot],
      ]),
      8,
      [0, -p.radius * 0.35, 0],
      flat,
      p.accentColor
    );
  }

  // Big tail fins, leaning out, each with a round tail light at its back.
  const tilt = (p.finTilt * Math.PI) / 180;
  for (const side of [1, -1]) {
    const u = [side * Math.sin(tilt), Math.cos(tilt), 0];
    const v = [0, 0, 1];
    const w = cross(u, v);
    const base = p.radius * 0.45;
    slab(
      mesh,
      smooth([
        [base, tail + 8],
        [base + p.finHeight, tail - 10],
        [base + p.finHeight, tail + 14],
        [base, tail + p.finLength],
      ]),
      7,
      [side * p.radius * 0.35, 0, 0],
      [u, v, w],
      p.bodyColor
    );
    ellipsoid(
      mesh,
      add([side * p.radius * 0.35, 0, 0], add(scale(u, base + 6), [0, 0, tail + 4])),
      5.5,
      8,
      p.tailLightColor,
      glossy,
      16
    );
  }

  // Chrome bullet bumpers on the nose, which are its cannons, a ring around
  // a dark intake between them, and a chrome nozzle at the tail.
  for (const side of [1, -1]) {
    const at = [side * p.radius * 0.55, -p.radius * 0.32, nose - p.radius * 0.4];
    ellipsoid(mesh, at, p.bumperRadius, p.bumperRadius * 1.7, p.trimColor, glossy, 20);
    cannons.push({position: add(at, [0, 0, p.bumperRadius * 1.7 + 1]), direction: [0, 0, 1]});
  }
  const intakeZ = tail + span * 0.98;
  ellipsoid(mesh, [0, 0, intakeZ], p.radius * 0.42, 3, darkColors.intake, 0, 32);
  torus(mesh, p.radius * 0.45, intakeZ, 2.5, p.trimColor, p.highlight, 40);
  pod(
    mesh,
    [0, 0, 0],
    tail - 14,
    tail + 22,
    p.radius * 0.42,
    engineColor(p.trimColor),
    p.highlight,
    32
  );
  exhausts.push({position: [0, 0, tail - 14], radius: p.radius * 0.24});
}

// buildSeedpod builds a seedpod: see the styles at the top.
function buildSeedpod(p, mesh, exhausts, cannons, spinner) {
  const back = -p.length * 0.5;
  const front = p.length * 0.5;
  const glossy = p.highlight * 1.3;
  const height = p.radius * p.flatten;

  // The pod is an almond, a little flattened, with a glowing seam along its
  // top.
  const steps = 80;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const u = i / steps;
    return {r: p.radius * Math.sin(Math.PI * u) ** 0.7, z: back + p.length * u, color: p.bodyColor};
  });
  profile[0] = {...profile[0], r: 0, normal: [0, -1]};
  profile[steps] = {...profile[steps], r: 0, normal: [0, 1]};
  let start = mesh.vertices.length;
  lathe(mesh, profile, 48);
  squash(mesh, start, [1, p.flatten, 1]);
  for (let i = start; i < mesh.vertices.length; i++) {
    const [x, y] = mesh.vertices[i].position;
    if (y > 0 && Math.abs(x) < p.radius * 0.07) {
      mesh.vertices[i].color = p.glowColor;
    }
  }
  highlight(mesh, start, p.highlight);

  // A dewdrop canopy, a glowing bulb for an engine at the back, two thorns
  // for cannons, and two curly sprouts for antennae.
  ellipsoid(
    mesh,
    [0, height * 0.75, front * 0.3],
    p.radius * 0.42,
    p.radius * 0.7,
    p.glassColor,
    glossy
  );
  ellipsoid(mesh, [0, 0, back + 4], p.radius * 0.32, p.radius * 0.26, p.glowColor, glossy, 24);
  exhausts.push({position: [0, 0, back + 4 - p.radius * 0.26], radius: p.radius * 0.2});
  for (const side of [1, -1]) {
    const at = [side * p.radius * 0.6, -height * 0.25, front * 0.35];
    start = mesh.vertices.length;
    lathe(
      mesh,
      [
        {r: 0, z: -2, normal: [0, -1], color: p.trimColor},
        {r: 5.5, z: 0, color: p.trimColor},
        {r: 2.5, z: 14, color: p.trimColor},
        {r: 0, z: 28, normal: [0, 1], color: p.trimColor},
      ],
      16
    );
    mesh.translate(start, at);
    highlight(mesh, start, p.highlight);
    cannons.push({position: add(at, [0, 0, 29]), direction: [0, 0, 1]});

    const sprout = (t) =>
      add(
        [side * p.radius * 0.22, height * 0.85, front * 0.42],
        [
          side * (6 * t + 6 * Math.sin(t * Math.PI)),
          34 * Math.sin(t * Math.PI * 0.55),
          26 * t - 30 * t * t,
        ]
      );
    for (let i = 0; i < 8; i++) {
      rod(mesh, sprout(i / 8), sprout((i + 1) / 8), 1.6, p.trimColor, 0, 8);
    }
    ellipsoid(mesh, sprout(1), 4, 4, p.glowColor, glossy, 12);
  }

  // The petals are the fighter's spinner, which turns around the pod's
  // length, so they have no highlight: it would turn with them.
  //
  // Petal wings sweep back from the pod's back to both sides, fanned from a
  // little below level to a little above, each a flat leaf, lighter toward
  // its tip, curling as petalCurl says: in toward each other behind the
  // pod, like a squid's, by default. None stand straight up or down behind
  // the pod, so the view from behind it stays clear.
  const spread = (p.petalSpread * Math.PI) / 180;
  for (let k = 0; k < p.petals; k++) {
    const side = k % 2 ? -1 : 1;
    const perSide = Math.max(1, Math.floor(p.petals / 2));
    const fan = perSide > 1 ? Math.floor(k / 2) / (perSide - 1) : 0.5;
    const elevation = -0.45 + 1.05 * fan;
    const radial = [side * Math.cos(elevation), Math.sin(elevation), 0];
    const w = normalize([
      radial[0] * Math.sin(spread),
      radial[1] * Math.sin(spread),
      -Math.cos(spread),
    ]);
    const v = normalize(sub(radial, scale(w, dot(radial, w))));
    const u = cross(v, w);
    const rings = 16;
    const half = p.petalLength / 2;
    const points = Array.from({length: rings + 1}, (_, i) => {
      const a = Math.PI * (i / rings - 0.5);
      const t = (1 + Math.sin(a)) / 2;
      return {
        r: p.petalWidth * Math.cos(a),
        z: half * (1 + Math.sin(a)),
        normal: [Math.cos(a) / p.petalWidth, Math.sin(a) / half],
        color: p.accentColor.map((value, c) => value + (p.petalTipColor[c] - value) * t * t),
      };
    });
    start = spinner.vertices.length;
    lathe(spinner, points, 24);
    squash(spinner, start, [1, 0.18, 1]);
    bend(spinner, start, p.petalLength, p.petalCurl);
    const base = [radial[0] * p.radius * 0.35, radial[1] * height * 0.35, back * 0.75];
    orient(spinner, start, [u, v, w], base);
  }
}

// buildTeapot builds a teapot: see the styles at the top.
function buildTeapot(p, mesh, exhausts, cannons) {
  const radius = p.bellyRadius;
  const height = p.bellyHeight;
  const glossy = p.highlight * 1.3;
  const up = [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ];
  const lerp = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
  const curvePoint = (p0, p1, p2, t) => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);

  // The belly is spun around Z and stood up: an ellipse from its foot to its
  // shoulder, with a band around its middle, closed flat under the lid.
  const [low, high] = [-1, 1.05];
  const steps = 48;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const a = low + ((high - low) * i) / steps;
    const z = height * Math.sin(a);
    return {
      r: radius * Math.cos(a),
      z,
      normal: [Math.cos(a) / radius, Math.sin(a) / height],
      color: p.band && Math.abs(z) < height * 0.12 ? p.accentColor : p.bodyColor,
    };
  });
  const bottom = height * Math.sin(low);
  const top = height * Math.sin(high);
  const neck = radius * Math.cos(high);
  profile.unshift({r: 0, z: bottom, normal: [0, -1], color: p.bodyColor});
  profile.push({r: 0, z: top, normal: [0, 1], color: p.bodyColor});
  const start = mesh.vertices.length;
  lathe(mesh, profile, 56);
  orient(mesh, start, up);
  highlight(mesh, start, p.highlight);
  torus(mesh, radius * Math.cos(low), 0, 4, p.trimColor, p.highlight, 48, up, [0, bottom, 0]);

  // Polka dots spread over the belly, away from the band, the spout and the
  // handle: small flattened bubbles just above its surface.
  for (let i = 0; i < p.dots; i++) {
    const a = -0.75 + (1.5 * (i + 0.5)) / p.dots;
    const around = i * 2.39996;
    const front = Math.cos(around);
    if ((p.band && Math.abs(Math.sin(a)) < 0.2) || Math.abs(front) > 0.85) {
      continue;
    }
    const [r, y] = [radius * Math.cos(a), height * Math.sin(a)];
    const normal = normalize([
      (Math.cos(a) / radius) * Math.sin(around),
      Math.sin(a) / height,
      (Math.cos(a) / radius) * front,
    ]);
    const at = add([r * Math.sin(around), y, r * front], scale(normal, 0.6));
    ellipsoid(mesh, at, 6, 1.8, p.accentColor, p.highlight, 14, basisFor(normal));
  }

  // The glass lid on a gilded rim, with a gilded knob.
  torus(mesh, neck, 0, 3.5, p.trimColor, p.highlight, 40, up, [0, top, 0]);
  ellipsoid(mesh, [0, top, 0], neck * 0.95, neck * 0.65, p.glassColor, glossy, 32, up);
  ellipsoid(mesh, [0, top + neck * 0.65 + 5, 0], 7, 7, p.trimColor, glossy, 14);

  // The spout curves up out of the belly's front and forward, narrowing to a
  // flared, gilded tip, which is where it fires from.
  const spout = [
    [0, -height * 0.25, radius * 0.85],
    [0, height * 0.55, radius + p.spoutLength * 0.35],
    [0, height * 0.55, radius + p.spoutLength],
  ];
  const pieces = 10;
  for (let i = 0; i < pieces; i++) {
    const [t0, t1] = [i / pieces, (i + 1) / pieces];
    rod(
      mesh,
      curvePoint(...spout, t0),
      curvePoint(...spout, t1),
      13 - 6.5 * ((t0 + t1) / 2),
      p.bodyColor,
      p.highlight,
      20
    );
  }
  const tip = spout[2];
  const direction = normalize(sub(spout[2], spout[1]));
  torus(mesh, 6.5, 0, 2.5, p.trimColor, p.highlight, 20, basisFor(direction), tip);
  cannons.push({position: add(tip, scale(direction, 3)), direction});

  // The handle loops out behind, an oval handleSize tall whose ends meet the
  // belly's back, with two little jets under it.
  const ends = 1.4;
  const endY = p.handleSize * Math.sin(ends);
  const backAtEnds = radius * Math.sqrt(Math.max(0, 1 - (endY / height) ** 2));
  const depth = p.handleSize * 1.35;
  const middle = -backAtEnds * 0.9 + depth * Math.cos(ends);
  const loop = (t) => [0, p.handleSize * Math.sin(t), middle - depth * Math.cos(t)];
  for (let i = 0; i < 14; i++) {
    const [t0, t1] = [-ends + (2 * ends * i) / 14, -ends + (2 * ends * (i + 1)) / 14];
    rod(mesh, loop(t0), loop(t1), 5.5, p.bodyColor, p.highlight, 14);
  }
  for (const side of [1, -1]) {
    const at = [side * 14, -height * 0.45, 0];
    pod(mesh, at, -radius - 8, -radius * 0.6, 8, engineColor(p.trimColor), p.highlight, 20);
    exhausts.push({position: add(at, [0, 0, -radius - 8]), radius: 5});
  }

  // A saucer plate on each side for a wing, tilted up, on a gilded arm, with
  // a cup of tea on it.
  const tilt = (p.plateTilt * Math.PI) / 180;
  for (const side of [1, -1]) {
    const u = [Math.cos(tilt), side * Math.sin(tilt), 0];
    const v = [0, 0, 1];
    const w = cross(u, v);
    const plateTop = w[1] < 0 ? scale(w, -1) : w;
    const center = [side * (radius + p.plateSize * 0.9), -height * 0.15, -5];
    rod(mesh, [side * radius * 0.8, -height * 0.15, -5], center, 5, p.trimColor, p.highlight, 12);
    slab(mesh, regular(32, p.plateSize), 5, center, [u, v, plateTop], p.bodyColor, 4);
    torus(mesh, p.plateSize - 2, 0, 2.2, p.trimColor, p.highlight, 48, basisFor(plateTop), center);

    if (p.cups) {
      const cup = p.plateSize * 0.4;
      const cupStart = mesh.vertices.length;
      lathe(
        mesh,
        [
          {r: 0, z: 0, normal: [0, -1], color: p.bodyColor},
          {r: cup * 0.6, z: 0, color: p.bodyColor},
          {r: cup, z: cup * 1.05, color: p.bodyColor},
          {r: cup * 0.9, z: cup * 1.05, normal: [0, 1], color: p.trimColor},
          {r: cup * 0.8, z: cup * 0.8, normal: [0, 1], color: p.teaColor},
          {r: 0, z: cup * 0.8, normal: [0, 1], color: p.teaColor},
        ],
        28
      );
      orient(mesh, cupStart, basisFor(plateTop), add(center, scale(plateTop, 2.5)));
      highlight(mesh, cupStart, p.highlight);
      const handleAt = add(add(center, scale(plateTop, 2.5 + cup * 0.55)), [0, 0, -cup * 1.05]);
      torus(mesh, cup * 0.32, 0, 1.8, p.bodyColor, p.highlight, 16, basisFor([1, 0, 0]), handleAt);
    }
  }
}

// buildStarcruiser builds a starcruiser: see the styles at the top.
function buildStarcruiser(p, mesh, exhausts, cannons) {
  const glossy = p.highlight * 1.3;
  const up = [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ];
  const saucer = [0, p.saucerLift, p.saucerForward];
  const radius = p.saucerRadius;
  const height = p.saucerHeight;

  // The saucer, spun around Z and stood up, with a stripe around its rim, a
  // bridge on top and a glowing sensor dome underneath.
  const steps = 60;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const a = Math.PI * (i / steps - 0.5);
    const r = radius * Math.cos(a) ** 0.5;
    return {
      r,
      z: (a > 0 ? height : height * 0.8) * Math.sin(a),
      color: r > radius * 0.86 && r < radius * 0.93 && a > 0 ? p.accentColor : p.bodyColor,
    };
  });
  profile[0] = {...profile[0], r: 0, normal: [0, -1]};
  profile[steps] = {...profile[steps], r: 0, normal: [0, 1]};
  const start = mesh.vertices.length;
  lathe(mesh, profile, 64);
  orient(mesh, start, up, saucer);
  highlight(mesh, start, p.highlight);
  ellipsoid(
    mesh,
    add(saucer, [0, height * 0.8, 0]),
    radius * 0.32,
    height * 0.9,
    p.bodyColor,
    p.highlight,
    40,
    up
  );
  ellipsoid(
    mesh,
    add(saucer, [0, height * 1.6, -radius * 0.02]),
    radius * 0.12,
    radius * 0.08,
    p.glassColor,
    glossy,
    24,
    up
  );
  ellipsoid(
    mesh,
    add(saucer, [0, -height * 0.75, 0]),
    radius * 0.14,
    height * 0.6,
    p.glowColor,
    glossy,
    24,
    up
  );

  // Two impulse engines glow at the back of the saucer, where the flames go,
  // and two emitters under its front are its cannons.
  for (const side of [1, -1]) {
    const at = add(saucer, [side * radius * 0.22, 0, 0]);
    pod(mesh, at, -radius * 1.0, -radius * 0.78, 6, () => p.bussardColor, glossy, 20);
    exhausts.push({position: add(at, [0, 0, -radius]), radius: 4});

    const emitter = add(saucer, [side * radius * 0.3, -height * 0.55, radius * 0.86]);
    ellipsoid(mesh, emitter, 4.5, 4.5, p.trimColor, glossy, 12);
    cannons.push({position: add(emitter, [0, 0, 5]), direction: [0, 0, 1]});
  }

  // The secondary hull, below and behind the saucer, with a glowing
  // deflector dish in a rim at its front, joined to the saucer by a swept
  // neck.
  const hullY = p.saucerLift - p.hullDrop;
  const hullFront = p.saucerForward - radius * 0.35;
  const hullBack = hullFront - p.hullLength;
  pod(mesh, [0, hullY, 0], hullBack, hullFront, p.hullRadius, () => p.bodyColor, p.highlight, 40);
  ellipsoid(
    mesh,
    [0, hullY, hullFront - p.hullRadius * 0.35],
    p.hullRadius * 0.72,
    p.hullRadius * 0.55,
    p.glowColor,
    glossy,
    32
  );
  torus(
    mesh,
    p.hullRadius * 0.74,
    hullFront - p.hullRadius * 0.4,
    2.5,
    p.trimColor,
    p.highlight,
    32,
    null,
    [0, hullY, 0]
  );
  slab(
    mesh,
    smooth([
      [hullY + p.hullRadius * 0.5, hullFront - p.hullLength * 0.35],
      [p.saucerLift - height * 0.4, p.saucerForward - radius * 0.55],
      [p.saucerLift - height * 0.4, p.saucerForward - radius * 0.1],
      [hullY + p.hullRadius * 0.5, hullFront - p.hullLength * 0.05],
    ]),
    p.hullRadius * 0.7,
    [0, 0, 0],
    [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
    p.bodyColor,
    6
  );

  // Two nacelles, held high on pylons swept back from the hull, each with a
  // glowing collector at its front and a glowing strip along its inside.
  const nacelleY = p.saucerLift + p.nacelleLift;
  const nacelleFront = hullBack + p.nacelleLength * 0.85;
  const nacelleBack = nacelleFront - p.nacelleLength;
  for (const side of [1, -1]) {
    const x = side * p.nacelleSpan;
    pod(
      mesh,
      [x, nacelleY, 0],
      nacelleBack,
      nacelleFront,
      p.nacelleRadius,
      () => p.bodyColor,
      p.highlight,
      32
    );
    ellipsoid(
      mesh,
      [x, nacelleY, nacelleFront - p.nacelleRadius * 0.4],
      p.nacelleRadius * 1.02,
      p.nacelleRadius * 0.95,
      p.bussardColor,
      glossy,
      28
    );
    rod(
      mesh,
      [x - side * p.nacelleRadius * 0.85, nacelleY, nacelleBack + p.nacelleRadius * 1.2],
      [x - side * p.nacelleRadius * 0.85, nacelleY, nacelleFront - p.nacelleRadius * 2.2],
      3.2,
      p.glowColor,
      glossy,
      10
    );

    // The pylon lies in the plane through the hull's axis and the nacelle's,
    // reaching from one to the other, swept back.
    const from = [0, hullY, 0];
    const outward = normalize(sub([x, nacelleY, 0], from));
    const reach = Math.hypot(...sub([x, nacelleY, 0], from));
    const top = cross(outward, [0, 0, 1]);
    slab(
      mesh,
      smooth(
        [
          [p.hullRadius * 0.5, hullBack + p.hullLength * 0.42],
          [reach - p.nacelleRadius * 0.5, nacelleBack + p.nacelleLength * 0.42],
          [reach - p.nacelleRadius * 0.5, nacelleBack + p.nacelleLength * 0.18],
          [p.hullRadius * 0.5, hullBack + p.hullLength * 0.12],
        ],
        2
      ),
      7,
      from,
      [outward, [0, 0, 1], top[1] < 0 ? scale(top, -1) : top],
      p.bodyColor,
      4
    );
  }
}

// droopedWing adds a wing reaching out from the middle on side, angled droop
// radians down from level: outline is in its own plane, as [how far out,
// z], where how far out is measured along the wing from the middle. It also
// adds stripes, each the part of the wing between two of its fractions of
// outline's reach, in color. It returns the wing's outward direction.
function droopedWing(mesh, side, droop, outline, thickness, color, stripes = [], stripeColor) {
  const u = [side * Math.cos(droop), -Math.sin(droop), 0];
  const v = [0, 0, 1];
  const w = cross(u, v);
  const top = w[1] < 0 ? scale(w, -1) : w;
  slab(mesh, smooth(outline), thickness, [0, 0, 0], [u, v, top], color);
  for (const [from, to] of stripes) {
    // A stripe is the wing's outline cut to between from and to of the way
    // from its root edge, outline[0] to outline[3], to its tip edge,
    // outline[1] to outline[2].
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [rootBack, tipBack, tipFront, rootFront] = outline;
    slab(
      mesh,
      smooth(
        [
          lerp(rootBack, tipBack, from),
          lerp(rootBack, tipBack, to),
          lerp(rootFront, tipFront, to),
          lerp(rootFront, tipFront, from),
        ],
        2
      ),
      thickness + 1.2,
      [0, 0, 0],
      [u, v, top],
      stripeColor,
      4
    );
  }
  return u;
}

// flattened adds an ellipsoid at center, radius wide and length long,
// squashed to flatten as tall, with a highlight.
function flattened(mesh, center, radius, length, flatten, color, amount, sides = 32) {
  const start = mesh.vertices.length;
  ellipsoid(mesh, [0, 0, 0], radius, length, color, 0, sides);
  squash(mesh, start, [1, flatten, 1]);
  mesh.translate(start, center);
  highlight(mesh, start, amount);
}

// buildBirdOfPrey builds a bird-of-prey: see the styles at the top.
function buildBirdOfPrey(p, mesh, exhausts, cannons) {
  const glossy = p.highlight * 1.3;
  const headZ = p.bodyLength * 0.5 + p.neckLength + p.headLength * 0.4;

  // The flat body, with a glowing engine strip across its back.
  flattened(
    mesh,
    [0, 6, 0],
    p.bodyWidth * 0.6,
    p.bodyLength / 2,
    0.5,
    p.bodyColor,
    p.highlight,
    40
  );
  flattened(
    mesh,
    [0, 14, -p.bodyLength * 0.1],
    p.bodyWidth * 0.25,
    p.bodyLength * 0.35,
    0.6,
    p.accentColor,
    p.highlight,
    24
  );
  const strip = (side) => [side * p.bodyWidth * 0.35, 6, -p.bodyLength * 0.46];
  rod(mesh, strip(-1), strip(1), 5, p.glowColor, 0, 12);
  for (const side of [1, -1]) {
    exhausts.push({position: add(strip(side * 0.6), [0, 0, -4]), radius: 5});
  }

  // The neck reaches forward to the head: a bird's head, with a window on
  // top, a beak at its front, and a torpedo glowing under it.
  const neck = [
    [0, 10, p.bodyLength * 0.35],
    [0, 4, headZ - p.headLength * 0.35],
  ];
  rod(mesh, neck[0], neck[1], p.headRadius * 0.5, p.bodyColor, p.highlight, 20);
  flattened(
    mesh,
    [0, 4, headZ],
    p.headRadius,
    p.headLength / 2,
    0.75,
    p.bodyColor,
    p.highlight,
    32
  );
  ellipsoid(
    mesh,
    [0, 4 + p.headRadius * 0.55, headZ + p.headLength * 0.1],
    p.headRadius * 0.45,
    p.headLength * 0.22,
    p.glassColor,
    glossy,
    20
  );
  flattened(
    mesh,
    [0, 0, headZ + p.headLength * 0.45],
    p.headRadius * 0.45,
    p.headLength * 0.22,
    0.6,
    p.accentColor,
    p.highlight,
    20
  );
  const torpedo = [0, -p.headRadius * 0.45, headZ + p.headLength * 0.32];
  ellipsoid(mesh, torpedo, 5, 5, p.glowColor, glossy, 12);
  cannons.push({position: add(torpedo, [0, 0, 6]), direction: [0, 0, 1]});

  // The wings, broad at the body and narrowing to their tips, angled down,
  // with feather stripes and a cannon on each tip.
  const droop = (p.wingDroop * Math.PI) / 180;
  const root = p.bodyWidth * 0.45;
  for (const side of [1, -1]) {
    const u = droopedWing(
      mesh,
      side,
      droop,
      [
        [root, -p.wingChord * 0.55],
        [p.wingSpan, -p.wingChord * 0.25],
        [p.wingSpan, p.wingChord * 0.05],
        [root, p.wingChord * 0.45],
      ],
      8,
      p.bodyColor,
      [
        [0.35, 0.45],
        [0.6, 0.7],
      ],
      p.accentColor
    );
    const at = add(scale(u, p.wingSpan + 3), [0, 0, 0]);
    rod(
      mesh,
      add(at, [0, 0, -p.wingChord * 0.2]),
      add(at, [0, 0, p.wingChord * 0.45]),
      4,
      p.trimColor,
      p.highlight,
      12
    );
    muzzle(mesh, add(at, [0, 0, p.wingChord * 0.45]), 6, p);
    cannons.push({position: add(at, [0, 0, p.wingChord * 0.45 + 1]), direction: [0, 0, 1]});
  }
}

// buildBattleCruiser builds a battle-cruiser: see the styles at the top.
function buildBattleCruiser(p, mesh, exhausts, cannons) {
  const glossy = p.highlight * 1.3;
  const lerp = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
  const curvePoint = (p0, p1, p2, t) => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);
  const bodyZ = -p.bodyLength * 0.3;
  const podZ = bodyZ + p.bodyLength * 0.5 + p.neckLength + p.podRadius * 0.8;

  // The engine body: flattened, with a hump on its back and a glowing
  // engine at its tail.
  flattened(mesh, [0, 0, bodyZ], p.bodyWidth, p.bodyLength / 2, 0.45, p.bodyColor, p.highlight, 40);
  flattened(
    mesh,
    [0, p.bodyWidth * 0.3, bodyZ - p.bodyLength * 0.1],
    p.bodyWidth * 0.4,
    p.bodyLength * 0.32,
    0.6,
    p.bodyColor,
    p.highlight,
    28
  );
  const tail = [0, 0, bodyZ - p.bodyLength * 0.5];
  ellipsoid(mesh, tail, p.bodyWidth * 0.3, 6, p.glowColor, glossy, 24);
  exhausts.push({position: add(tail, [0, 0, -6]), radius: p.bodyWidth * 0.18});

  // The long neck arches up and forward to the command pod: a bulb with a
  // ring around it, a window on top and a glowing strip across its front.
  const neck = [
    [0, p.bodyWidth * 0.2, bodyZ + p.bodyLength * 0.35],
    [0, p.bodyWidth * 0.2 + p.neckLength * 0.25, bodyZ + p.bodyLength * 0.5 + p.neckLength * 0.5],
    [0, 4, podZ - p.podRadius * 0.6],
  ];
  for (let i = 0; i < 8; i++) {
    rod(
      mesh,
      curvePoint(...neck, i / 8),
      curvePoint(...neck, (i + 1) / 8),
      p.neckRadius,
      p.bodyColor,
      p.highlight,
      16
    );
  }
  const podCenter = [0, 4, podZ];
  ellipsoid(mesh, podCenter, p.podRadius, p.podRadius * 0.85, p.bodyColor, p.highlight, 36);
  torus(mesh, p.podRadius * 0.98, 0, 3, p.accentColor, p.highlight, 40, null, podCenter);
  ellipsoid(
    mesh,
    add(podCenter, [0, p.podRadius * 0.7, 0]),
    p.podRadius * 0.4,
    p.podRadius * 0.4,
    p.glassColor,
    glossy,
    20
  );
  rod(
    mesh,
    add(podCenter, [-p.podRadius * 0.5, -p.podRadius * 0.2, p.podRadius * 0.72]),
    add(podCenter, [p.podRadius * 0.5, -p.podRadius * 0.2, p.podRadius * 0.72]),
    3.5,
    p.glowColor,
    0,
    10
  );

  // Swept wings, drooping a little, out to long nacelles, whose glowing
  // fronts are its cannons.
  const droop = (p.wingDroop * Math.PI) / 180;
  for (const side of [1, -1]) {
    const u = droopedWing(
      mesh,
      side,
      droop,
      [
        [p.bodyWidth * 0.6, bodyZ - p.bodyLength * 0.4],
        [p.wingSpan, bodyZ - p.bodyLength * 0.75],
        [p.wingSpan, bodyZ - p.bodyLength * 0.25],
        [p.bodyWidth * 0.6, bodyZ + p.bodyLength * 0.2],
      ],
      9,
      p.bodyColor,
      [[0.55, 0.65]],
      p.accentColor
    );
    const at = scale(u, p.wingSpan + p.nacelleRadius * 0.6);
    const back = bodyZ - p.bodyLength * 0.5 - p.nacelleLength * 0.35;
    const front = back + p.nacelleLength;
    pod(mesh, at, back, front, p.nacelleRadius, engineColor(p.bodyColor), p.highlight, 28);
    ellipsoid(
      mesh,
      add(at, [0, 0, front - p.nacelleRadius * 0.4]),
      p.nacelleRadius * 0.95,
      p.nacelleRadius * 0.7,
      p.glowColor,
      glossy,
      20
    );
    exhausts.push({position: add(at, [0, 0, back]), radius: p.nacelleRadius * 0.55});
    cannons.push({position: add(at, [0, 0, front + 1]), direction: [0, 0, 1]});
  }
}

// buildBumblebee builds a bumblebee: see the styles at the top.
function buildBumblebee(p, mesh, exhausts, cannons, spinner, translucent) {
  const glossy = p.highlight * 1.3;
  const thoraxZ = 0;
  const headZ = p.thoraxRadius * 0.9 + p.headRadius * 0.8;
  const abdomenFront = -p.thoraxRadius * 0.7;
  const abdomenBack = abdomenFront - p.abdomenLength;

  // The abdomen, striped from its front to its back, dropping a little
  // behind the thorax.
  const steps = 72;
  const profile = Array.from({length: steps + 1}, (_, i) => {
    const t = i / steps;
    const a = Math.PI * (t - 0.5);
    const band = Math.floor((1 - t) * (2 * p.stripes + 1));
    return {
      r: p.abdomenRadius * Math.cos(a),
      z: abdomenBack + p.abdomenLength * t,
      normal: [Math.cos(a) / p.abdomenRadius, Math.sin(a) / (p.abdomenLength / 2)],
      color: band % 2 ? p.accentColor : p.bodyColor,
    };
  });
  let start = mesh.vertices.length;
  lathe(mesh, profile, 40);
  mesh.translate(start, [0, -p.abdomenRadius * 0.15, 0]);
  highlight(mesh, start, p.highlight);

  // The stinger at the abdomen's tip, with the flame coming out under it.
  start = mesh.vertices.length;
  lathe(
    mesh,
    [
      {r: 0, z: 2, normal: [0, 1], color: p.accentColor},
      {r: 6, z: 0, color: p.accentColor},
      {r: 0, z: -24, normal: [0, -1], color: p.accentColor},
    ],
    16
  );
  mesh.translate(start, [0, 0, abdomenBack + 3]);
  highlight(mesh, start, p.highlight);
  exhausts.push({position: [0, -p.abdomenRadius * 0.45, abdomenBack + 6], radius: 6});

  // The round thorax and the black head, with big glossy eyes and curly
  // antennae, whose glowing tips are its cannons.
  ellipsoid(mesh, [0, 0, thoraxZ], p.thoraxRadius, p.thoraxRadius, p.bodyColor, p.highlight, 36);
  const head = [0, p.thoraxRadius * 0.15, headZ];
  ellipsoid(mesh, head, p.headRadius, p.headRadius * 0.9, p.accentColor, p.highlight, 32);
  for (const side of [1, -1]) {
    ellipsoid(
      mesh,
      add(head, [side * p.headRadius * 0.62, p.headRadius * 0.15, p.headRadius * 0.25]),
      p.headRadius * 0.48,
      p.headRadius * 0.6,
      p.glassColor,
      glossy,
      20
    );
    const antenna = (t) =>
      add(head, [
        side * (p.headRadius * 0.3 + 10 * t),
        p.headRadius * 0.8 + 32 * Math.sin(t * Math.PI * 0.6),
        p.headRadius * 0.4 + 34 * t,
      ]);
    for (let i = 0; i < 8; i++) {
      rod(mesh, antenna(i / 8), antenna((i + 1) / 8), 1.8, p.accentColor, 0, 8);
    }
    ellipsoid(mesh, antenna(1), 4.5, 4.5, p.glowColor, glossy, 12);
    cannons.push({position: add(antenna(1), [0, 0, 5]), direction: [0, 0, 1]});
  }

  // Four glossy wings on the thorax's back, see-through, the front pair
  // bigger, each a
  // flat leaf curving a little.
  for (const side of [1, -1]) {
    for (const [size, direction] of [
      [1, [side * 0.8, 0.5, -0.45]],
      [0.72, [side * 0.85, 0.28, -0.75]],
    ]) {
      const w = normalize(direction);
      const v = normalize(sub([0, 1, 0], scale(w, w[1])));
      const u = cross(v, w);
      const [length, width] = [p.wingLength * size, p.wingWidth * size];
      const rings = 14;
      const points = Array.from({length: rings + 1}, (_, i) => {
        const a = Math.PI * (i / rings - 0.5);
        return {
          r: width * Math.cos(a),
          z: (length / 2) * (1 + Math.sin(a)),
          normal: [Math.cos(a) / width, Math.sin(a) / (length / 2)],
          color: p.wingColor,
        };
      });
      start = translucent.vertices.length;
      lathe(translucent, points, 24);
      squash(translucent, start, [1, 0.1, 1]);
      bend(translucent, start, length, 0.35);
      orient(
        translucent,
        start,
        [u, v, w],
        [side * p.thoraxRadius * 0.35, p.thoraxRadius * 0.7, thoraxZ - 4]
      );
      highlight(translucent, start, glossy);
    }
  }

  // Six little legs under the thorax, each bent at the knee, on a ball
  // foot.
  for (const side of [1, -1]) {
    for (const z of [p.thoraxRadius * 0.45, 0, -p.thoraxRadius * 0.45]) {
      const hip = [side * p.thoraxRadius * 0.45, -p.thoraxRadius * 0.6, thoraxZ + z];
      const knee = add(hip, [side * 16, -4, 0]);
      const foot = add(knee, [side * 5, -18, -4]);
      rod(mesh, hip, knee, 3, p.accentColor, p.highlight, 8);
      rod(mesh, knee, foot, 2.6, p.accentColor, p.highlight, 8);
      ellipsoid(mesh, foot, 4, 4, p.accentColor, glossy, 10);
    }
  }
}

const builders = {
  "cross-wing": buildCrossWing,
  "twin-panel": buildTwinPanel,
  saucer: buildSaucer,
  dart: buildDart,
  longwing: buildLongwing,
  "atomic-saucer": buildAtomicSaucer,
  streamliner: buildStreamliner,
  seedpod: buildSeedpod,
  starcruiser: buildStarcruiser,
  "bird-of-prey": buildBirdOfPrey,
  "battle-cruiser": buildBattleCruiser,
  bumblebee: buildBumblebee,
  teapot: buildTeapot,
};

// buildFighter builds a fighter of style from its parameters, p. It returns
// the mesh along with its exhausts and its cannons, and two meshes of parts
// that are drawn apart from it, each empty for a style without any:
// - spinner: the parts that turn around the fighter's length, along Z, such
//   as the seedpod's petals.
// - translucent: the see-through parts, such as the bumblebee's wings.
function buildFighter(style, p) {
  const mesh = new Mesh();
  const spinner = new Mesh();
  const translucent = new Mesh();
  const exhausts = [];
  const cannons = [];
  builders[style](p, mesh, exhausts, cannons, spinner, translucent);
  return {mesh, exhausts, cannons, spinner, translucent};
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

  const styleName = styleArg || "cross-wing";
  const {style, parameters} =
    seed == null
      ? {style: styleName, parameters: {...styles[styleName]}}
      : randomParameters(mulberry32(seed), styleArg);

  for (const [name, value] of Object.entries(overrides)) {
    if (!(name in styles[style])) {
      throw new Error(
        `unknown parameter "--${name}" for ${style}; its parameters are ${Object.keys(
          styles[style]
        ).join(", ")}`
      );
    }
    parameters[name] = Array.isArray(styles[style][name])
      ? String(value).split(",").map(Number)
      : Number(value);
  }
  for (const name of [
    "stripe",
    "windowSpokes",
    "panelSides",
    "panelSpokes",
    "lights",
    "legs",
    "petals",
    "dots",
    "band",
    "cups",
    "stripes",
  ]) {
    if (name in parameters) {
      parameters[name] = Math.round(parameters[name]);
    }
  }

  // Files are named for their style, then their seed, if any.
  const defaultName =
    seed != null ? `${style}-starfighter-${seed}.obj` : `${style}-starfighter.obj`;
  const filename = out || defaultName;
  const output = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, "..", "resources", "obj", filename);

  const round = (_, v) => (typeof v === "number" ? Number(v.toFixed(3)) : v);
  const {mesh, exhausts, cannons, spinner, translucent} = buildFighter(style, parameters);
  const rounded = JSON.stringify(parameters, round);
  const roundedExhausts = JSON.stringify(exhausts, round);
  const roundedCannons = JSON.stringify(cannons, round);
  const header = [
    "Generated by bin/generate-starfighter.js",
    seed == null ? `Style ${style}` : `Seed ${seed}, style ${style}`,
    `Rarity ${rarities[style]}`,
    `Parameters ${rounded}`,
    `Exhausts ${roundedExhausts}`,
    `Cannons ${roundedCannons}`,
  ];

  // The spinner and the translucent parts each go in a file of their own
  // beside the fighter's, so a scene can turn the spinner, and draw the
  // translucent parts with a material that is see-through.
  const parts = [
    {name: "Spinner", mesh: spinner, info: {axis: [0, 0, 1]}},
    {name: "Translucent", mesh: translucent, info: {opacity: 0.5}},
  ];
  const written = [];
  for (const {name, mesh: part, info} of parts) {
    if (part.vertices.length) {
      const partOutput = `${output.replace(/\.obj$/, "")}-${name.toLowerCase()}.obj`;
      header.push(`${name} ${JSON.stringify({file: path.basename(partOutput), ...info})}`);
      fs.writeFileSync(
        partOutput,
        part.toObj(
          [...header.slice(0, 3), `The ${name.toLowerCase()} parts of the fighter beside it`],
          name.toLowerCase()
        )
      );
      written.push(`wrote ${partOutput}: ${part.vertices.length} vertices`);
    }
  }
  fs.writeFileSync(output, mesh.toObj(header, "starfighter"));

  /* eslint-disable no-console */
  console.log(
    `wrote ${output}: ${mesh.vertices.length} vertices, ${mesh.triangles.length} triangles`
  );
  console.log(
    `${seed == null ? `style ${style}` : `seed ${seed}, style ${style}`}, ${rarities[style]}`
  );
  console.log(`parameters ${rounded}`);
  console.log(`exhausts ${roundedExhausts}`);
  console.log(`cannons ${roundedCannons}`);
  written.forEach((line) => console.log(line));
  /* eslint-enable no-console */
}

main();
