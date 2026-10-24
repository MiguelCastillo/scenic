// fly lets the player fly the ling from perch to perch on its wings, on the
// energy that flapping takes and standing gives back (see Mushroom Hops in
// games/wingborn/README.md).
// - Space: flap, which climbs, and uses energy. Standing, it takes off.
// - Left and right arrows: turn, banking into the turn in the air.
// - Down arrow: dive, sinking fast, to drop onto a perch far below.
// - Up and down arrows, standing: walk forward and back, across the top of
//   a cap and off its edge into a glide, over the ground, or anywhere on a
//   tree: up its trunk, along its branches, around and under them.
//
// In the air the ling always flies forward, along its node's +Z axis, and
// glides down while it isn't flapping, getting its energy back slowly once
// it has rested its wings a moment. Out of energy, it can't flap, and sinks
// fast. Coming down onto a perch, the top of a cap, it lands there, and
// coming down to the ground, it lands on that, and either way it stands
// until it takes off again, getting its energy back, faster on a perch. It
// bumps off stems and the sides of caps, and the undersides of caps are
// ceilings: it can't walk in under a cap without room to take off, twice its
// height, and flying up under one, it bumps its head and flies on out from
// under it.
//
// It sticks to trees, the way ants do: touching one flying, or walking into
// its trunk, it holds on wherever it touched, and walks on from there,
// following its trunk, branches and twigs as tubes, the tree's skeleton:
// "skeleton" in the state of each tree under the node the trees setting
// names (see bin/generate-tree.js, which lists a tree's skeleton). On a
// tree it has a nose and an up of its own, the way it faces and the
// surface's normal, rather than a heading, so it can walk straight up the
// trunk or upside down under a branch. Taking off, it can't stick to a tree
// again for a moment, so it lets go of the one it was on.
//
// Perches are the nodes under the node the perches setting names whose
// collider has "perch" set, such as a cap's: {"shape": "cylinder",
// "radius": 190, "height": 160, "perch": true} (see
// bin/generate-mushroom.js, which lists a mushroom's colliders). The top of
// the cylinder is where the ling lands, anywhere it is within the
// cylinder's radius, or with "dome" in the collider, how far a round cap
// falls from its middle to its rim, on the cap's curve, so its feet stay on
// the cap as it walks across it. The ling's own collider, a sphere around
// its feet, bumps it off every other collider, such as a stem's.
//
// Keys come from the frame's `keys` and time from its `seconds`, so it flies
// at the same speed at any frame rate. Its settings come from
// "script.settings" in the node's config, and all are optional:
// - speed: how fast it flies forward, in scene units per second. 380 by
//   default.
// - turnRate: how fast it turns, in degrees per second. 100 by default.
// - walkSpeed: how fast it walks. 160 by default.
// - treeWalkSpeed: how fast it walks on a tree, which is big. 450 by
//   default.
// - height: how tall it stands, to the tips of its antennae, so it keeps its
//   head out of the caps above it. 150 by default.
// - bank: how far it leans into a turn in the air, in degrees. 30 by
//   default.
// - climbSpeed: how fast it climbs while flapping, in scene units per
//   second. 260 by default.
// - takeoffSpeed: how fast it rises as it takes off. 300 by default.
// - glideSink: how fast it sinks while gliding. 260 by default.
// - fallSink: how fast it sinks once out of energy, and diving. 320 by
//   default.
// - response: how quickly its climbing and sinking catch up with the keys,
//   in seconds. 0.3 by default.
// - drain: how much of its energy flapping uses, per second. 0.25 by
//   default, so it can flap for four seconds.
// - refill: how much of its energy standing on a perch gives back, per
//   second. 0.6 by default.
// - groundRefill: how much of its energy standing on the ground gives back,
//   per second. 0.3 by default.
// - airRefill: how much of its energy it gets back per second in the air,
//   once it has gone restDelay seconds without flapping. 0.1 by default.
// - restDelay: how long it has to go without flapping before it starts
//   getting energy back in the air, so tapping Space can't keep it up.
//   0.4 by default.
// - perches: the ID of the node the perches are under. "mushrooms" by
//   default.
// - ground: the ID of a terrain node to land on (see Terrain in
//   @scenic/runtime). Without one, the ground is flat at 0.
// - trees: the ID of the node the trees are under. Optional.
// - view: the ID of a node that follows the ling, facing the way a camera
//   behind it should look, for a chase camera to follow (see
//   third-person.js in @scenic/camera), which only follows a heading: its
//   heading, or on a tree, the way its nose points, and up a trunk, into
//   the trunk. Optional.
//
// How it is flying is written to this script's settings every frame, so a
// saved state flies on from where it was, and the wings under it can flap
// along (see flap.js):
// - energy: how much it has, 0 to 1. 1 by default.
// - perch: the ID of the perch it stands on, or null off one.
// - grounded: whether it stands on the ground.
// - tree: the ID of the tree it holds on to, or null off one.
// - nose: which way it faces on a tree, along the surface, as a direction.
// - letGoSeconds: how long since it took off from a tree.
// - lastPerch: the ID of the last perch it stood on, or null before it has
//   stood on one.
// - heading: which way it heads, in degrees around the world's up axis. The
//   node's Y rotation by default.
// - rise: how fast it is going up, negative going down.
// - roll: how far it is banked, in degrees.
// - flapping: whether it is flapping, 0 or 1.
// - restedSeconds: how long it has gone without flapping in the air.
// - up: which way is up for it, standing: the surface's normal, which it
//   leans toward as it lands and walks, so it stands along a cap's dome or
//   a slope of the ground. In the air it flies upright, and up is [0, 1, 0].
//
// With "hud" in the node's state, such as {"hud": "energy"}, it tells the
// app's UI about its energy every frame, on that channel of
// sceneManager.ui: {energy, standing}, whether it stands on anything.
const {mat4} = require("@scenic/math");
const {collision} = require("@scenic/scene");

const defaults = {
  speed: 380,
  turnRate: 100,
  walkSpeed: 160,
  treeWalkSpeed: 450,
  height: 150,
  bank: 30,
  climbSpeed: 260,
  takeoffSpeed: 300,
  glideSink: 260,
  fallSink: 320,
  response: 0.3,
  drain: 0.25,
  refill: 0.6,
  groundRefill: 0.3,
  airRefill: 0.1,
  restDelay: 0.4,
  perches: "mushrooms",
  ground: null,
  trees: null,
  view: null,
  energy: 1,
  perch: null,
  grounded: false,
  tree: null,
  nose: [0, 0, 1],
  letGoSeconds: 1,
  lastPerch: null,
  rise: 0,
  roll: 0,
  flapping: 0,
  restedSeconds: 0,
  up: [0, 1, 0],
};

// STANDABLE is how far out from its middle a cap can be stood on, as a part
// of its radius: past that, the dome turns too steep, toward its rim.
const STANDABLE = 0.9;

// rotation is the rotation matrix for the ling heading degrees around the
// world's up axis, climbing degrees nose up, and rolled degrees around its
// nose, turned to the angles node transforms use (see mat4.rotationAngles),
// which rotate in a different order.
function rotation(heading, climb, roll) {
  // A positive X rotation tips +Z down, so climbing is a negative one.
  const turned = mat4.multiply(
    mat4.identity(),
    mat4.rotate(mat4.identity(), 0, heading, 0),
    mat4.rotate(mat4.identity(), -climb, 0, 0)
  );
  return mat4.rotationAngles(
    mat4.multiply(mat4.identity(), turned, mat4.rotate(mat4.identity(), 0, 0, roll))
  );
}

// perchesUnder is every perch under node, as {id, center, radius, top,
// bottom, dome}: where its cylinder stands in the world, and how far its
// cap falls from its middle to its rim.
function perchesUnder(sceneManager, node) {
  const perches = [];
  const visit = (child) => {
    const collider = sceneManager.getNodeStateByID(child.id)?.collider;
    if (collider?.perch) {
      const {center, radius, halfHeight} = collision.worldCollider(collider, child.worldMatrix);
      const yScale = halfHeight / ((collider.height ?? 2) / 2);
      perches.push({
        id: child.id,
        center,
        radius,
        top: center[1] + halfHeight,
        bottom: center[1] - halfHeight,
        dome: (collider.dome ?? 0) * yScale,
      });
    }
    child.items.forEach(visit);
  };
  node?.items.forEach(visit);
  return perches;
}

// surfaceAt is the height of perch's cap at (x, z), on the curve of its
// dome, from its top in the middle down to its rim.
function surfaceAt(perch, x, z) {
  const out = Math.min(1, Math.hypot(x - perch.center[0], z - perch.center[2]) / perch.radius);
  return perch.top - perch.dome * (1 - Math.sqrt(1 - out * out));
}

// pushOut moves position out sideways to the rim of perch's cap, straight
// out from its middle.
function pushOut(position, perch) {
  const [dx, dz] = [position[0] - perch.center[0], position[2] - perch.center[2]];
  const out = Math.hypot(dx, dz);
  if (out > 0 && out < perch.radius) {
    position[0] = perch.center[0] + (dx * perch.radius) / out;
    position[2] = perch.center[2] + (dz * perch.radius) / out;
  }
}

// facing is the rotation for the ling with its own up axis along up and its
// nose, its +Z axis, along nose, which is along the surface up is the
// normal of. It is turned to the angles node transforms use (see
// mat4.rotationAngles).
function facing(nose, up) {
  const side = cross(up, nose);
  // Matrix4 data is row-major, so each axis is a column.
  // prettier-ignore
  return mat4.rotationAngles([
    side[0], up[0], nose[0], 0,
    side[1], up[1], nose[1], 0,
    side[2], up[2], nose[2], 0,
    0, 0, 0, 1,
  ]);
}

// standing is the rotation for the ling heading degrees around the world's
// up axis while it stands on a surface whose normal is up: its nose along
// its heading, laid along the surface.
function standing(heading, up) {
  const radians = (heading * Math.PI) / 180;
  return facing(along([Math.sin(radians), 0, Math.cos(radians)], up), up);
}

// along is direction laid along the surface normal is the normal of, length
// 1, or the way up that surface goes when direction points straight into
// it or out of it.
function along(direction, normal) {
  const flat = direction.map((v, i) => v - normal[i] * dot(direction, normal));
  if (Math.hypot(...flat) > 0.2) {
    return normalize(flat);
  }
  return normalize([0, 1, 0].map((v, i) => v - normal[i] * normal[1]));
}

// headingOf is the heading, in degrees around the world's up axis, that
// direction points, along the ground.
const headingOf = (direction) => (Math.atan2(direction[0], direction[2]) * 180) / Math.PI;

// turned is direction turned degrees around axis, both length 1, the way a
// heading turns, left toward +X around the world's up axis.
function turned(direction, axis, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  const across = cross(axis, direction);
  const lift = dot(axis, direction) * (1 - cos);
  return normalize(direction.map((v, i) => v * cos + across[i] * sin + axis[i] * lift));
}

// tubesOf is every tube of the trees under node, from the skeleton in each
// tree's state, placed in the world by its world matrix: {tree, points,
// radii, center, reach}, its tree's ID, its curve's three points, its
// radius at five even steps along it, and a ball around all of it, for
// skipping the tubes far away.
function tubesOf(sceneManager, node) {
  const tubes = [];
  for (const tree of node?.items ?? []) {
    const skeleton = sceneManager.getNodeStateByID(tree.id)?.skeleton;
    if (!skeleton) {
      continue;
    }
    const m = tree.worldMatrix.data || tree.worldMatrix;
    // Matrix4 data is row-major, so a point is placed by its rows.
    const place = ([x, y, z]) => [
      m[0] * x + m[1] * y + m[2] * z + m[3],
      m[4] * x + m[5] * y + m[6] * z + m[7],
      m[8] * x + m[9] * y + m[10] * z + m[11],
    ];
    const size = Math.hypot(m[0], m[4], m[8]);
    for (const tube of skeleton) {
      const points = tube.points.map(place);
      const radii = tube.radii.map((radius) => radius * size);
      const center = points[1];
      const reach =
        Math.max(...points.map((point) => Math.hypot(...sub(point, center)))) + Math.max(...radii);
      tubes.push({tree: tree.id, points, radii, center, reach});
    }
  }
  return tubes;
}

// surfaceOf is where on the tubes the surface nearest position is, as
// {tube, center, radius, normal, distance}: the point on the tube's curve
// nearest position, the tube's radius there, the way out from it through
// position, and how far position is from the surface, less than 0 inside
// it. Where tubes meet, it is the one position is deepest in, so that the
// tubes together are one surface. It is null when position is far from
// every tube.
function surfaceOf(tubes, position) {
  let found = null;
  for (const tube of tubes) {
    if (Math.hypot(...sub(position, tube.center)) > tube.reach + 100) {
      continue;
    }
    const at = (t) => curve(...tube.points, t);
    const away = (t) => Math.hypot(...sub(position, at(t)));
    // The nearest of a few even steps, then closer in on either side.
    let t = 0;
    for (let i = 1; i <= 16; i++) {
      t = away(i / 16) < away(t) ? i / 16 : t;
    }
    for (let step = 1 / 32; step > 0.0005; step /= 2) {
      t = [t - step, t + step]
        .filter((other) => other >= 0 && other <= 1)
        .reduce((best, other) => (away(other) < away(best) ? other : best), t);
    }
    const center = at(t);
    const radius = radiusOn(tube.radii, t);
    const out = sub(position, center);
    const length = Math.hypot(...out);
    const distance = length - radius;
    if (!found || distance < found.distance) {
      const normal = length ? out.map((v) => v / length) : [0, 1, 0];
      found = {tube, center, radius, normal, distance};
    }
  }
  return found;
}

// radiusOn is a tube's radius t along it, between its radii at five even
// steps.
function radiusOn(radii, t) {
  const at = t * (radii.length - 1);
  const i = Math.min(radii.length - 2, Math.floor(at));
  return radii[i] + (radii[i + 1] - radii[i]) * (at - i);
}

// curve is a point on a quadratic Bézier curve, the way tubes bend.
const curve = (p0, p1, p2, t) =>
  p0.map((v, i) => v * (1 - t) ** 2 + p1[i] * 2 * (1 - t) * t + p2[i] * t * t);

const sub = (a, b) => a.map((v, i) => v - b[i]);

// normalOnCap is the normal of perch's cap at (x, z), on the curve of its
// dome, tipping out from straight up toward its rim.
function normalOnCap(perch, x, z) {
  const [dx, dz] = [x - perch.center[0], z - perch.center[2]];
  const out = Math.hypot(dx, dz);
  const part = Math.min(0.99, out / perch.radius);
  if (!out || !perch.dome) {
    return [0, 1, 0];
  }
  // How steeply the dome falls away here, outward.
  const slope = (perch.dome * part) / (perch.radius * Math.sqrt(1 - part * part));
  return normalize([(dx / out) * slope, 1, (dz / out) * slope]);
}

// normalOnGround is the ground's normal at (x, z), from its height a little
// to either side, groundAt.
function normalOnGround(groundAt, x, z) {
  const step = 20;
  const slopeX = (groundAt(x + step, z) - groundAt(x - step, z)) / (2 * step);
  const slopeZ = (groundAt(x, z + step) - groundAt(x, z - step)) / (2 * step);
  return normalize([-slopeX, 1, -slopeZ]);
}

// Vectors: dot and cross products, and length 1.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a) => {
  const length = Math.hypot(...a) || 1;
  return a.map((v) => v / length);
};

module.exports = function createFlyScript(node) {
  return {
    update({seconds = 0, keys = new Set(), sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = {...defaults, ...state.script.settings};
      const flight = {
        energy: settings.energy,
        perch: settings.perch,
        grounded: settings.grounded,
        tree: settings.tree,
        nose: settings.nose,
        letGoSeconds: settings.letGoSeconds,
        lastPerch: settings.lastPerch,
        heading: settings.heading ?? state.transform.rotation[1],
        rise: settings.rise,
        roll: settings.roll,
        flapping: 0,
        restedSeconds: settings.restedSeconds,
        up: settings.up,
      };

      const held = (code) => (keys.has(code) ? 1 : 0);
      const turn = held("ArrowLeft") - held("ArrowRight");
      const flapKey = keys.has("Space");
      const diveKey = keys.has("ArrowDown");

      // ease is how much of the way to a target to close this frame, to get
      // about two thirds of the way there after time seconds at any frame
      // rate.
      const ease = (time) => (time > 0 ? 1 - Math.exp(-seconds / time) : 1);

      // Turning left heads toward +X, the camera's left when it is behind
      // the ling.
      flight.heading += turn * settings.turnRate * seconds;
      const radians = (flight.heading * Math.PI) / 180;

      // write saves where the ling is, turned to angles, and how it flies,
      // and puts the view there, facing view, a heading.
      const write = (position, angles, view = flight.heading) => {
        sceneManager.updateNodeStateByID(node.id, {
          transform: {...state.transform, position, rotation: angles},
          script: {...state.script, settings: {...state.script.settings, ...flight}},
        });
        const viewState = settings.view && sceneManager.getNodeStateByID(settings.view);
        if (viewState) {
          sceneManager.updateNodeStateByID(settings.view, {
            transform: {...viewState.transform, position, rotation: [0, view, 0]},
          });
        }
        if (state.hud) {
          sceneManager.ui.publish(state.hud, {
            energy: flight.energy,
            standing: !!flight.perch || flight.grounded || !!flight.tree,
          });
        }
      };

      // bump pushes position out of everything else with a collider, such as
      // stems, sideways only, so it can't climb them. Collisions are found
      // where it is now, which its world matrix only shows after this
      // script runs.
      const bump = (position) => {
        const worldMatrix = node.parent.worldMatrix.multiply(
          mat4.Matrix4.trs(position, state.transform.rotation, state.transform.scale)
        );
        for (const {node: other, normal, depth} of collision.findCollisions(
          sceneManager,
          node,
          worldMatrix
        )) {
          if (!sceneManager.getNodeStateByID(other.id).collider.perch) {
            position[0] += normal[0] * depth;
            position[2] += normal[2] * depth;
          }
        }
      };

      // groundAt is the ground's height under (x, z).
      const terrain = settings.ground && sceneManager.getNodeByID(settings.ground);
      const groundAt = (x, z) => (terrain ? terrain.heightAt(x, z) : 0);

      const start = state.transform.position;
      const perches = perchesUnder(sceneManager, sceneManager.getNodeByID(settings.perches));
      const tubes = tubesOf(
        sceneManager,
        settings.trees && sceneManager.getNodeByID(settings.trees)
      );

      // hold has it hold on to the tree where surface is, with its nose along
      // the surface the way heading points, or up it, going straight in.
      const hold = (surface, heading) => {
        flight.tree = surface.tube.tree;
        flight.perch = null;
        flight.grounded = false;
        flight.rise = 0;
        flight.up = surface.normal;
        flight.nose = along(heading, surface.normal);
        return surface.center.map((v, i) => v + surface.normal[i] * surface.radius);
      };

      // treeView is the heading a camera behind it on a tree looks: the way
      // its nose points, along the ground, or up a trunk, where its nose
      // points up, into the trunk, so the camera looks at it from outside.
      const treeView = () =>
        Math.hypot(flight.nose[0], flight.nose[2]) > 0.35
          ? headingOf(flight.nose)
          : headingOf(flight.up.map((v) => -v));

      // On a tree it holds on, rests, turns around its own up with the left
      // and right arrows, and walks the way its nose points with the up and
      // down arrows, onto whichever tube of the tree is under its feet. It
      // takes off with Space, away from the tree up a trunk.
      if (flight.tree) {
        flight.energy = Math.min(1, flight.energy + settings.refill * seconds);
        flight.roll = 0;
        const ownTubes = tubes.filter(({tree}) => tree === flight.tree);
        if (!flapKey && ownTubes.length) {
          flight.nose = turned(flight.nose, flight.up, turn * settings.turnRate * seconds);
          const walk = held("ArrowUp") - held("ArrowDown");
          const step = walk * settings.treeWalkSpeed * seconds;
          const moved = start.map((v, i) => v + flight.nose[i] * step);
          const surface = surfaceOf(ownTubes, moved);
          const position = surface ? hold(surface, flight.nose) : start;
          // Walking down to the ground, it steps off onto it, facing the
          // way it was walking.
          const ground = groundAt(position[0], position[2]);
          if (position[1] <= ground) {
            flight.tree = null;
            flight.grounded = true;
            flight.heading = headingOf(
              Math.hypot(flight.nose[0], flight.nose[2]) > 0.2 ? flight.nose : flight.up
            );
            position[1] = ground;
            write(position, standing(flight.heading, flight.up));
            return;
          }
          write(position, facing(flight.nose, flight.up), treeView());
          return;
        }
        flight.heading =
          Math.hypot(flight.nose[0], flight.nose[2]) > 0.35
            ? headingOf(flight.nose)
            : headingOf(flight.up);
        flight.tree = null;
        flight.rise = settings.takeoffSpeed;
        flight.restedSeconds = 0;
        flight.letGoSeconds = 0;
        flight.up = [0, 1, 0];
      }

      // Standing, on a perch or the ground, it rests, walks with the up and
      // down arrows, and takes off with Space. Walking out off its cap, a
      // little before the rim, where the dome turns steep, drops it into a
      // glide.
      if (flight.perch || flight.grounded) {
        const refill = flight.perch ? settings.refill : settings.groundRefill;
        flight.energy = Math.min(1, flight.energy + refill * seconds);
        flight.roll -= flight.roll * ease(settings.response);
        if (!flapKey) {
          flight.rise = 0;
          const walk = held("ArrowUp") - held("ArrowDown");
          const perch = perches.find(({id}) => id === flight.perch);
          // normalAt is the normal of what it stands on at (x, z).
          const normalAt = (x, z) =>
            perch ? normalOnCap(perch, x, z) : normalOnGround(groundAt, x, z);
          // stand saves it standing at position, leaning toward the normal
          // of what it stands on there.
          const stand = (position) => {
            const normal = normalAt(position[0], position[2]);
            const lean = ease(settings.response * 0.4);
            flight.up = normalize(flight.up.map((v, i) => v + (normal[i] - v) * lean));
            write(position, standing(flight.heading, flight.up));
          };
          if (!walk || (flight.perch && !perch)) {
            stand(start);
            return;
          }
          // It walks the way its nose points along the surface where it
          // stands, so it goes as fast up and down slopes as on the flat,
          // and follows a dome's curve, then settles back onto the surface
          // below.
          const step = walk * settings.walkSpeed * seconds;
          const ahead = [Math.sin(radians), 0, Math.cos(radians)];
          const nose = along(ahead, normalAt(start[0], start[2]));
          const position = start.map((v, i) => v + nose[i] * step);
          if (flight.grounded) {
            // Walking forward into a tree's trunk, it climbs on, and backing
            // into one, it stops.
            const surface = surfaceOf(tubes, position);
            if (surface && surface.distance <= 0) {
              if (walk < 0) {
                stand(start);
                return;
              }
              const onTree = hold(surface, nose);
              write(onTree, facing(flight.nose, flight.up), treeView());
              return;
            }
            bump(position);
            position[1] = groundAt(position[0], position[2]);
            // Only caps with room to take off from under them, twice its
            // height, can be walked under.
            for (const perch of perches) {
              if (position[1] + settings.height * 2 > perch.bottom) {
                pushOut(position, perch);
              }
            }
          } else if (
            Math.hypot(position[0] - perch.center[0], position[2] - perch.center[2]) <
              perch.radius * STANDABLE ||
            Math.hypot(position[0] - perch.center[0], position[2] - perch.center[2]) <
              Math.hypot(start[0] - perch.center[0], start[2] - perch.center[2])
          ) {
            // It walks anywhere on its cap short of the rim, and back in
            // from it, and steps off walking out past it.
            position[1] = surfaceAt(perch, position[0], position[2]);
          } else {
            flight.perch = null;
            flight.restedSeconds = 0;
          }
          stand(position);
          return;
        }
        flight.perch = null;
        flight.grounded = false;
        flight.rise = settings.takeoffSpeed;
        flight.restedSeconds = 0;
      }

      // In the air, Space flaps while there is energy for it, and otherwise
      // it glides, getting energy back, or sinks once there is none or while
      // it dives.
      flight.flapping = flapKey && !diveKey && flight.energy > 0 ? 1 : 0;
      flight.restedSeconds = flight.flapping ? 0 : flight.restedSeconds + seconds;
      const resting = flight.restedSeconds >= settings.restDelay;
      const change = flight.flapping ? -settings.drain : resting ? settings.airRefill : 0;
      flight.energy = Math.max(0, Math.min(1, flight.energy + change * seconds));
      const targetRise = flight.flapping
        ? settings.climbSpeed
        : flight.energy > 0 && !diveKey
          ? -settings.glideSink
          : -settings.fallSink;
      flight.rise += (targetRise - flight.rise) * ease(settings.response);
      flight.roll += (-turn * settings.bank - flight.roll) * ease(settings.response);

      const position = [
        start[0] + Math.sin(radians) * settings.speed * seconds,
        start[1] + flight.rise * seconds,
        start[2] + Math.cos(radians) * settings.speed * seconds,
      ];

      // Touching a tree above the ground, it holds on where it touched,
      // unless it has only just let go of one.
      flight.letGoSeconds += seconds;
      const surface = flight.letGoSeconds > 0.4 && surfaceOf(tubes, position);
      if (surface && surface.distance <= 0 && position[1] > groundAt(position[0], position[2])) {
        const going = normalize([
          Math.sin(radians),
          flight.rise / settings.speed,
          Math.cos(radians),
        ]);
        const onTree = hold(surface, going);
        write(onTree, facing(flight.nose, flight.up), treeView());
        return;
      }

      // Touching a perch's cap, coming down onto it or into its side, it
      // sticks, the way ants do: it lands on the nearest part of the cap it
      // can stand on. Coming up from well under one, it bumps its head on
      // its underside, and stops rising, flying on out from under it. Rising
      // into its side or past its rim, it is pushed back out the side.
      for (const perch of perches) {
        const out = Math.hypot(position[0] - perch.center[0], position[2] - perch.center[2]);
        const surface = surfaceAt(perch, position[0], position[2]);
        const head = position[1] + settings.height;
        if (out > perch.radius || position[1] > surface || head < perch.bottom) {
          continue;
        }
        // Near the rim, within its own width of it, it isn't under the cap.
        const width = state.collider?.radius ?? 0;
        if (start[1] + settings.height <= perch.bottom + 1 && out < perch.radius - width) {
          position[1] = perch.bottom - settings.height;
          flight.rise = Math.min(flight.rise, 0);
        } else if (flight.rise <= 0) {
          if (out > perch.radius * STANDABLE) {
            const pull = (perch.radius * STANDABLE) / out;
            position[0] = perch.center[0] + (position[0] - perch.center[0]) * pull;
            position[2] = perch.center[2] + (position[2] - perch.center[2]) * pull;
          }
          position[1] = surfaceAt(perch, position[0], position[2]);
          flight.perch = perch.id;
          flight.lastPerch = perch.id;
          flight.rise = 0;
          break;
        } else {
          pushOut(position, perch);
        }
      }

      if (!flight.perch) {
        bump(position);
      }

      // Coming down to the ground, it lands on it.
      const ground = groundAt(position[0], position[2]);
      if (!flight.perch && position[1] <= ground) {
        position[1] = ground;
        flight.grounded = true;
        flight.rise = 0;
      }

      // It tips its nose up climbing and down sinking, a little, and flies
      // upright.
      const landed = flight.perch || flight.grounded;
      const climb = landed ? 0 : (Math.atan2(flight.rise, settings.speed) * 90) / Math.PI;
      flight.up = landed ? flight.up : [0, 1, 0];
      write(position, rotation(flight.heading, climb, flight.roll));
    },
  };
};
