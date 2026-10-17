// fly lets the player fly its node like an arcade rocket: it always flies
// forward, along its node's +Z axis, and the keys steer it.
// - Space: boost. The throttle climbs to full and the rocket speeds up, and
//   it settles back to cruising when Space is let go.
// - B: the rocket booster, once a lap in a race: it flies boosterSpeedUp
//   faster for boosterSeconds, on top of Space (see "lap" below).
// - Left and right arrows: turn, banking into the turn.
// - Up and down arrows: dive and climb, like pushing a flight stick forward
//   and pulling it back. Letting go levels the rocket out. The upArrowDives
//   setting swaps them.
// - The mouse, when the mouseSteering setting is on: moving it left and right
//   turns, and moving it up and down dives and climbs the same way as the up
//   and down arrows. It steers on top of the keys.
//
// Keys come from the frame's `keys`, the mouse from its `mouse`, and time
// from its `seconds`, so it flies at the same speed at any frame rate. Its
// settings come from "script.settings" in the node's config, and all are
// optional:
// - cruiseSpeed: how fast it flies at the cruising throttle, in scene units
//   per second. 250 by default.
// - boostSpeed: how fast it flies at full throttle. 1200 by default.
// - cruiseThrottle: the throttle while not boosting, 0 to 1. 0.3 by default.
// - turnRate: how fast it turns, in degrees per second. 75 by default.
// - climbRate: how fast it pitches up or down, in degrees per second. 45 by
//   default.
// - maxClimb: how steeply it can climb or dive, in degrees. 60 by default.
// - bank: how far it leans into a turn, in degrees. 40 by default.
// - response: how quickly throttle and banking catch up with the keys, in
//   seconds. 0.3 by default.
// - levelTime: how quickly it levels out after climbing or diving, in
//   seconds. 1.5 by default.
// - minHeight: the lowest it flies above the ground, so it skims the ground
//   rather than going through it. 80 by default.
// - ground: the ID of a terrain node to fly over (see Terrain in
//   @scenic/runtime), so the ground rises and falls with its hills. Without
//   one, the ground is flat at 0.
// - pullUpHeight: how far above minHeight it starts pulling out of a dive.
//   The closer it gets to minHeight, the less steeply it can dive, so it
//   eases down onto minHeight and levels out there, however steep the dive.
//   400 by default.
// - upArrowDives: whether the up arrow dives, like a flight stick, rather
//   than climbs. true by default.
// - mouseSteering: whether the mouse steers. false by default.
// - mouseSensitivity: how far the mouse turns and pitches the rocket, in
//   degrees per pixel. 0.15 by default.
// - boosterSpeedUp: how much faster the booster makes it fly, as a part of
//   its speed. 0.4 by default, 40% faster.
// - boosterSeconds: how long the booster lasts, in seconds. 6 by default.
//
// How it is flying is written to this script's settings every frame, so a
// saved state flies on from where it was, and flames under the node that
// follow the throttle (see flame.js) burn harder when boosting:
// - heading: which way it heads, in degrees around the world's up axis. The
//   node's Y rotation by default.
// - climb: how steeply it climbs, in degrees, negative when diving. 0 by
//   default.
// - roll: how far it is banked, in degrees. 0 by default.
// - throttle: how hard the engine burns, 0 to 1. cruiseThrottle by default.
// - boosterLap: the lap the booster was fired on, or null.
// - boosterLeft: how many seconds of the booster are left, 0 when it is off.
// - boost: how hard the booster burns, 0 to 1, which the flames follow to
//   burn bigger (see flame.js). It eases up when the booster fires and back
//   down when it runs out, as quickly as the throttle does.
// They are kept rather than read back from the node's rotation, since the
// same rotation can come from different angles.
//
// In a network game, the other players see it when its node names a channel
// of sceneManager.network in its state, such as {"network": "player"}: every
// frame it publishes {position, rotation, throttle, boost} there, for the
// copies of it on the other players' screens (see remote-ship.js).
//
// It flies from wherever the node's state puts it, so moving the node, such
// as in the editor, moves the rocket. While its node's state has "held" set,
// such as before a race starts (see race.js), it stays where it is, though
// its engine still follows Space, so it can rev up for the start.
//
// The booster can be fired once each lap of a race, while the node's state
// has "lap" set, the lap it is on, which race.js sets for every racer; 0 or
// none means it isn't racing, and it has no booster. With "hud" in the
// node's state, such as {"hud": "booster"}, it tells the app's UI about the
// booster every frame, on that channel of sceneManager.ui: {ready, left},
// whether it can be fired, and how many seconds of it are left.
//
// When the node has a collider (see collision in @scenic/scene), the rocket
// bounces off anything else with one, such as trees: it is pushed back out
// and its course turns away, like a ball off a wall. A collider with "bump"
// set, such as another ship's, {"shape": "sphere", "radius": 95, "bump":
// true}, is bumped rather than bounced off, like bumping shoulders: the
// rocket is nudged aside, half of the way out, since the other ship, flown
// the same way, nudges itself the other half, and its course doesn't turn.
// Pushing out assumes the node's parent is not rotated or scaled.
const {mat4} = require("@scenic/math");
const {collision} = require("@scenic/scene");

const defaults = {
  cruiseSpeed: 250,
  boostSpeed: 1200,
  cruiseThrottle: 0.3,
  turnRate: 75,
  climbRate: 45,
  maxClimb: 60,
  bank: 40,
  response: 0.3,
  levelTime: 1.5,
  minHeight: 80,
  pullUpHeight: 400,
  upArrowDives: true,
  mouseSteering: false,
  mouseSensitivity: 0.15,
  boosterSpeedUp: 0.4,
  boosterSeconds: 6,
  boosterLap: null,
  boosterLeft: 0,
  boost: 0,
};

// rotation is the rotation matrix for a rocket heading degrees around the
// world's up axis, climbing degrees nose up, and rolled degrees around its
// nose. It turns, then pitches, then rolls, which is the order a flying thing
// moves in. Node transforms rotate in a different order (see mat4.rotate),
// so the matrix is converted back to their angles with mat4.rotationAngles.
function rotation(heading, climb, roll) {
  // A positive X rotation tips +Z down, so climbing is a negative one.
  const turned = mat4.multiply(
    mat4.identity(),
    mat4.rotate(mat4.identity(), 0, heading, 0),
    mat4.rotate(mat4.identity(), -climb, 0, 0)
  );
  return mat4.multiply(mat4.identity(), turned, mat4.rotate(mat4.identity(), 0, 0, roll));
}

// bounce pushes the rocket out of anything its collider runs into at
// position, and turns its course away from what it hit: its nose is
// reflected off the surface, the way a ball bounces off a wall. What it
// bumps, a collider with "bump" set, it is only nudged half of the way out
// of, without turning. It returns whether its course turned, after updating
// position and flight.
function bounce(sceneManager, node, state, position, matrix, flight) {
  // Collisions are found where the rocket is now, which its world matrix
  // only shows after this script runs.
  const worldMatrix = node.parent.worldMatrix.multiply(
    mat4.Matrix4.trs(position, mat4.rotationAngles(matrix), state.transform.scale)
  );
  const hits = collision.findCollisions(sceneManager, node, worldMatrix);
  if (!hits.length) {
    return false;
  }

  let nose = [matrix[2], matrix[6], matrix[10]];
  let turned = false;
  for (const {node: other, normal, depth} of hits) {
    const bump = !!sceneManager.getNodeStateByID(other.id).collider.bump;
    for (let i = 0; i < 3; i++) {
      position[i] += normal[i] * (bump ? depth / 2 : depth);
    }

    const into = nose[0] * normal[0] + nose[1] * normal[1] + nose[2] * normal[2];
    if (!bump && into < 0) {
      nose = nose.map((v, i) => v - 2 * into * normal[i]);
      turned = true;
    }
  }
  if (!turned) {
    return false;
  }

  // The nose is [sin(heading) cos(climb), sin(climb), cos(heading) cos(climb)]
  // (see rotation). The heading turns the short way, so that it stays close
  // to what it was.
  const degrees = (radians) => (radians * 180) / Math.PI;
  const heading = degrees(Math.atan2(nose[0], nose[2]));
  flight.heading += ((((heading - flight.heading) % 360) + 540) % 360) - 180;
  flight.climb = degrees(Math.asin(Math.max(-1, Math.min(1, nose[1]))));
  return true;
}

module.exports = function createFlyScript(node) {
  return {
    update({seconds = 0, keys = new Set(), mouse = {x: 0, y: 0}, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = {...defaults, ...state.script.settings};
      const flight = {
        heading: settings.heading ?? state.transform.rotation[1],
        climb: settings.climb ?? 0,
        roll: settings.roll ?? 0,
        throttle: settings.throttle ?? settings.cruiseThrottle,
        boosterLap: settings.boosterLap,
        boosterLeft: Math.max(0, settings.boosterLeft - seconds),
        boost: settings.boost,
      };

      const held = (code) => (keys.has(code) ? 1 : 0);
      const turn = held("ArrowLeft") - held("ArrowRight");
      const climb = (held("ArrowUp") - held("ArrowDown")) * (settings.upArrowDives ? -1 : 1);

      // ease is how much of the way to a target to close this frame, to get
      // about two thirds of the way there after time seconds at any frame
      // rate.
      const ease = (time) => (time > 0 ? 1 - Math.exp(-seconds / time) : 1);

      const targetThrottle = held("Space") ? 1 : settings.cruiseThrottle;
      flight.throttle += (targetThrottle - flight.throttle) * ease(settings.response);

      // publish tells the other players in a network game where it is.
      const publish = (position, rotation) => {
        if (state.network) {
          sceneManager.network.publish(state.network, {
            position,
            rotation,
            throttle: flight.throttle,
            boost: flight.boost,
          });
        }
      };

      // B fires the booster, once a lap, and not while held at the start.
      const lap = state.lap ?? 0;
      const racing = lap > 0 && !state.held;
      if (racing && flight.boosterLap !== lap && keys.has("KeyB")) {
        flight.boosterLap = lap;
        flight.boosterLeft = settings.boosterSeconds;
      }
      const targetBoost = flight.boosterLeft > 0 ? 1 : 0;
      flight.boost += (targetBoost - flight.boost) * ease(settings.response);
      if (state.hud) {
        sceneManager.ui.publish(state.hud, {
          ready: racing && flight.boosterLap !== lap,
          left: flight.boosterLeft,
        });
      }

      if (state.held) {
        sceneManager.updateNodeStateByID(node.id, {
          script: {...state.script, settings: {...state.script.settings, ...flight}},
        });
        publish(state.transform.position, state.transform.rotation);
        return;
      }

      // Turning left heads toward +X, the camera's left when it is behind the
      // rocket. A positive roll lowers the rocket's right side, so it banks
      // into the turn.
      // The mouse turns and pitches by how far it moved, in degrees. Moving
      // it right turns right, and moving it up pushes the stick forward.
      const mouseFactor = settings.mouseSteering ? settings.mouseSensitivity : 0;
      const mouseTurn = -mouse.x * mouseFactor;
      const mouseClimb = -mouse.y * mouseFactor * (settings.upArrowDives ? -1 : 1);

      // The rocket banks by how hard it is turning, as a part of turnRate, so
      // that a quick flick of the mouse banks it as far as the keys do.
      const turnSpeed = seconds > 0 ? mouseTurn / (settings.turnRate * seconds) : 0;
      const steer = Math.max(-1, Math.min(1, turn + turnSpeed));
      flight.heading += turn * settings.turnRate * seconds + mouseTurn;
      flight.roll += (-steer * settings.bank - flight.roll) * ease(settings.response);

      if (climb || mouseClimb) {
        flight.climb += climb * settings.climbRate * seconds + mouseClimb;
      } else {
        flight.climb -= flight.climb * ease(settings.levelTime);
      }
      flight.climb = Math.max(-settings.maxClimb, Math.min(settings.maxClimb, flight.climb));

      // groundAt is the ground's height under (x, z).
      const terrain = settings.ground && sceneManager.getNodeByID(settings.ground);
      const groundAt = (x, z) => (terrain ? terrain.heightAt(x, z) : 0);

      // Near the ground, the steepest dive allowed shrinks to level at
      // minHeight. It shrinks gently at first, so a full dive bends into the
      // pull-up rather than snapping, and in proportion to height at the end,
      // so the rocket eases onto minHeight rather than landing on it.
      const [x, y, z] = state.transform.position;
      const above = y - groundAt(x, z) - settings.minHeight;
      const t = Math.max(0, Math.min(1, above / (settings.pullUpHeight || 1)));
      flight.climb = Math.max(flight.climb, -settings.maxClimb * t * (2 - t));

      // Speed follows throttle: cruising speed at the cruising throttle, up to
      // boost speed at full throttle, and boosterSpeedUp faster while the
      // booster burns.
      const {cruiseSpeed, boostSpeed, cruiseThrottle} = settings;
      const boost = Math.max(0, (flight.throttle - cruiseThrottle) / (1 - cruiseThrottle || 1));
      const booster = flight.boosterLeft > 0 ? 1 + settings.boosterSpeedUp : 1;
      const speed = (cruiseSpeed + (boostSpeed - cruiseSpeed) * boost) * booster;

      // The rocket's nose, its local +Z axis, is the third column of its
      // rotation, since Matrix4 data is row-major.
      let matrix = rotation(flight.heading, flight.climb, flight.roll);
      const nose = [matrix[2], matrix[6], matrix[10]];
      const position = state.transform.position.map((v, i) => v + nose[i] * speed * seconds);

      // Never go below minHeight, such as when the rocket is moved below it
      // in the editor, or the ground rises under it.
      const lowest = groundAt(position[0], position[2]) + settings.minHeight;
      if (position[1] < lowest) {
        position[1] = lowest;
        flight.climb = Math.max(flight.climb, 0);
      }

      if (bounce(sceneManager, node, state, position, matrix, flight)) {
        matrix = rotation(flight.heading, flight.climb, flight.roll);
      }

      sceneManager.updateNodeStateByID(node.id, {
        transform: {...state.transform, position, rotation: mat4.rotationAngles(matrix)},
        script: {...state.script, settings: {...state.script.settings, ...flight}},
      });
      publish(position, mat4.rotationAngles(matrix));
    },
  };
};
