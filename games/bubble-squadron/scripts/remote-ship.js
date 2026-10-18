// remote-ship flies a ship whose flying is done somewhere else, such as on
// the server that runs a race, or in another player's browser: it is moved
// by what it hears about where the ship is, a few times a second (see
// fly.js and glide.js, which publish it). It gets those messages,
// {position, rotation, throttle, boost, booster}, as the frame's `messages`,
// from the input channel its node's "input" names, and glides the node to
// where the last one says, every frame, so that it moves smoothly between
// messages rather than jumping at each one, at any frame rate. It snaps
// there for the first one, so it never glides in from where the ship
// started.
//
// Its settings come from "script.settings" in the node's config, and all are
// optional:
// - smoothing: how long, in seconds, the ship takes to get most of the way
//   to where it was last said to be. Longer is smoother, and further behind.
//   0.1 by default.
//
// What it is gliding to is written to its settings, as target, and the
// throttle it has reached as throttle, and its booster's boost, which the
// flames and spinners under it follow (see flame.js and spin.js).

const {mat4} = require("@scenic/math");

// turnToward is the rotation, as transform angles, ease of the way from
// rotation to target. It blends the rotations themselves rather than each
// angle, because the same rotation can have very different angles, such as
// [180, 88, 180] and [0, 92, 0], and blending those angle by angle would
// tumble the ship on its way between two rotations that are the same.
// Blending the matrices and squaring them back up is close enough for the
// small turns between two messages.
function turnToward(rotation, target, ease) {
  const from = mat4.rotate(mat4.identity(), ...rotation);
  const to = mat4.rotate(mat4.identity(), ...target);
  const blended = from.map((value, i) => value + (to[i] - value) * ease);

  // Make the blend's axes, its first three rows, unit length and square to
  // each other again, so that it is a rotation.
  const row = (r) => [blended[r * 4], blended[r * 4 + 1], blended[r * 4 + 2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => a.map((v) => v / Math.hypot(...a));
  const x = unit(row(0));
  const y = unit(row(1).map((v, i) => v - dot(row(1), x) * x[i]));
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  [x, y, z].forEach((axis, r) => axis.forEach((v, c) => (blended[r * 4 + c] = v)));
  return mat4.rotationAngles(blended);
}

module.exports = function createRemoteShipScript(node) {
  return {
    update({seconds = 0, messages = [], sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings || {};
      const {smoothing = 0.1} = settings;

      const target = messages.at(-1) ?? settings.target;
      if (!target) {
        return;
      }

      // How far to go toward the target this frame, the same each second
      // however many frames there are, and all the way the first time.
      const ease = !settings.target || smoothing <= 0 ? 1 : 1 - Math.exp(-seconds / smoothing);
      const {position, rotation} = state.transform;
      const throttle = settings.throttle ?? target.throttle;

      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          position: position.map((value, i) => value + (target.position[i] - value) * ease),
          rotation: turnToward(rotation, target.rotation, ease),
        },
        script: {
          ...state.script,
          settings: {
            ...settings,
            target,
            throttle: throttle + (target.throttle - throttle) * ease,
            boost: target.boost ?? 0,
          },
        },
      });
    },
  };
};
