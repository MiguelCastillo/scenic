// hover makes its node hold position in the air, like a ship hovering: it
// bobs up and down, banks from side to side, and tips its nose up and down,
// each at a slightly different pace so the motion does not look mechanical.
// It moves around wherever the node starts, so the node's own transform still
// places it. Its settings come from "script.settings" in the node's config:
// - bob: how far it rises and sinks, in scene units.
// - roll: how far it banks to each side, in degrees.
// - pitch: how far it tips its nose up and down, in degrees.
// - period: how long one bob up and down takes, in seconds. Banking and
//   tipping take a little longer and shorter, from the same period.
//
// The motion comes from the frame's time rather than from adding up small
// steps, so it is always where it should be for that time.
const {angles} = require("@scenic/math");

module.exports = function createHoverScript(node) {
  // Where the node starts, which the motion is around. It is read on the first
  // frame, once the node's state is set up.
  let start = null;

  return {
    preRender({ms, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      if (!start) {
        start = {position: [...state.transform.position], rotation: [...state.transform.rotation]};
      }

      const {bob, roll, pitch, period} = state.script.settings;
      const t = (ms / 1000 / period) * 2 * Math.PI;
      const wave = (speed, offset = 0) => Math.sin(t * speed + angles.degToRad(offset));

      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          position: [start.position[0], start.position[1] + bob * wave(1), start.position[2]],
          rotation: [
            start.rotation[0] + pitch * wave(1.7, 90),
            start.rotation[1],
            start.rotation[2] + roll * wave(0.6),
          ],
        },
      });
    },
  };
};
