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
// - position and rotation: where it hovers around. The node's own on the
//   first frame by default, and written back then, so a saved state hovers
//   around the same place.
//
// The motion comes from the frame's time rather than from adding up small
// steps, so it is always where it should be for that time.
const {angles} = require("@scenic/math");

module.exports = function createHoverScript(node) {
  return {
    preRender({ms, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const {settings} = state.script;
      const {
        bob,
        roll,
        pitch,
        period,
        position = state.transform.position,
        rotation = state.transform.rotation,
      } = settings;
      const t = (ms / 1000 / period) * 2 * Math.PI;
      const wave = (speed, offset = 0) => Math.sin(t * speed + angles.degToRad(offset));

      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          position: [position[0], position[1] + bob * wave(1), position[2]],
          rotation: [
            rotation[0] + pitch * wave(1.7, 90),
            rotation[1],
            rotation[2] + roll * wave(0.6),
          ],
        },
        script: {...state.script, settings: {...settings, position, rotation}},
      });
    },
  };
};
