// fly lets the player fly the ling from perch to perch on its wings, on the
// energy that flapping takes and standing gives back (see Mushroom Hops in
// games/wingborn/README.md).
// - Space: flap, which climbs, and uses energy. Standing, it takes off.
// - Left and right arrows: turn, banking into the turn in the air.
// - Down arrow: dive, sinking fast, to drop onto a perch far below.
// - Up and down arrows, standing: walk forward and back, across the top of
//   a cap and off its edge into a glide, or over the ground.
//
// In the air the ling always flies forward, along its node's +Z axis, and
// glides down while it isn't flapping, getting its energy back slowly once
// it has rested its wings a moment. Out of energy, it can't flap, and sinks
// fast. Coming down onto a perch, the top of a cap, it lands there, and
// coming down to the ground, it lands on that, and either way it stands
// until it takes off again, getting its energy back, faster on a perch. It
// bumps off stems and the sides of caps.
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
//
// How it is flying is written to this script's settings every frame, so a
// saved state flies on from where it was, and the wings under it can flap
// along (see flap.js):
// - energy: how much it has, 0 to 1. 1 by default.
// - perch: the ID of the perch it stands on, or null off one.
// - grounded: whether it stands on the ground.
// - lastPerch: the ID of the last perch it stood on, or null before it has
//   stood on one.
// - heading: which way it heads, in degrees around the world's up axis. The
//   node's Y rotation by default.
// - rise: how fast it is going up, negative going down.
// - roll: how far it is banked, in degrees.
// - flapping: whether it is flapping, 0 or 1.
// - restedSeconds: how long it has gone without flapping in the air.
//
// With "hud" in the node's state, such as {"hud": "energy"}, it tells the
// app's UI about its energy every frame, on that channel of
// sceneManager.ui: {energy, standing}.
const {mat4} = require("@scenic/math");
const {collision} = require("@scenic/scene");

const defaults = {
  speed: 380,
  turnRate: 100,
  walkSpeed: 160,
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
  energy: 1,
  perch: null,
  grounded: false,
  lastPerch: null,
  rise: 0,
  roll: 0,
  flapping: 0,
  restedSeconds: 0,
};

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

module.exports = function createFlyScript(node) {
  return {
    update({seconds = 0, keys = new Set(), sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = {...defaults, ...state.script.settings};
      const flight = {
        energy: settings.energy,
        perch: settings.perch,
        grounded: settings.grounded,
        lastPerch: settings.lastPerch,
        heading: settings.heading ?? state.transform.rotation[1],
        rise: settings.rise,
        roll: settings.roll,
        flapping: 0,
        restedSeconds: settings.restedSeconds,
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

      // write saves where the ling is and how it flies, climbing degrees
      // nose up.
      const write = (position, climb) => {
        sceneManager.updateNodeStateByID(node.id, {
          transform: {
            ...state.transform,
            position,
            rotation: rotation(flight.heading, climb, flight.roll),
          },
          script: {...state.script, settings: {...state.script.settings, ...flight}},
        });
        if (state.hud) {
          sceneManager.ui.publish(state.hud, {
            energy: flight.energy,
            standing: !!flight.perch || flight.grounded,
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

      // Standing, on a perch or the ground, it rests, walks with the up and
      // down arrows, and takes off with Space. Walking off its cap, a little
      // before the rim, where the dome turns steep, drops it into a glide.
      if (flight.perch || flight.grounded) {
        const refill = flight.perch ? settings.refill : settings.groundRefill;
        flight.energy = Math.min(1, flight.energy + refill * seconds);
        flight.roll -= flight.roll * ease(settings.response);
        if (!flapKey) {
          flight.rise = 0;
          const walk = held("ArrowUp") - held("ArrowDown");
          const perch = perches.find(({id}) => id === flight.perch);
          if (!walk || (flight.perch && !perch)) {
            write(start, 0);
            return;
          }
          const step = walk * settings.walkSpeed * seconds;
          const position = [
            start[0] + Math.sin(radians) * step,
            start[1],
            start[2] + Math.cos(radians) * step,
          ];
          if (flight.grounded) {
            bump(position);
            position[1] = groundAt(position[0], position[2]);
          } else if (
            Math.hypot(position[0] - perch.center[0], position[2] - perch.center[2]) <
            perch.radius * 0.9
          ) {
            position[1] = surfaceAt(perch, position[0], position[2]);
          } else {
            flight.perch = null;
            flight.restedSeconds = 0;
          }
          write(position, 0);
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

      // Coming down through the top of a perch, it lands on it. Inside one
      // otherwise, it came from the side or below, and is pushed back out
      // the side.
      for (const perch of perches) {
        const [dx, dz] = [position[0] - perch.center[0], position[2] - perch.center[2]];
        const out = Math.hypot(dx, dz);
        const surface = surfaceAt(perch, position[0], position[2]);
        if (out > perch.radius || position[1] > surface || position[1] < perch.bottom) {
          continue;
        }
        if (flight.rise <= 0 && start[1] >= surface - 1) {
          position[1] = surface;
          flight.perch = perch.id;
          flight.lastPerch = perch.id;
          flight.rise = 0;
          break;
        }
        const push = out > 0 ? perch.radius / out : 0;
        position[0] = perch.center[0] + dx * push;
        position[2] = perch.center[2] + dz * push;
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

      // It tips its nose up climbing and down sinking, a little.
      const standing = flight.perch || flight.grounded;
      const climb = standing ? 0 : (Math.atan2(flight.rise, settings.speed) * 90) / Math.PI;
      write(position, climb);
    },
  };
};
