// orbit moves its node around a circle in the scene's X/Z plane, at a steady
// speed. Its settings come from "script.settings" in the node's config:
// - center: the center of the circle, as [x, y, z].
// - radius: the circle's radius, in scene units.
// - speed: how fast the node goes around, in degrees per second. A negative
//   speed goes the other way.
// - phase: where on the circle the node is at time 0, in degrees, so that
//   several nodes can share an orbit spaced out around it.
//
// The position comes from the frame's time rather than from adding up small
// steps, so it is always where it should be for that time.
const {angles} = require("@scenic/math");

module.exports = function createOrbitScript(node) {
  return {
    preRender({ms, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const {center, radius, speed, phase} = state.script.settings;
      const angle = angles.degToRad(phase + (speed * ms) / 1000);

      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          position: [
            center[0] + radius * Math.cos(angle),
            center[1],
            center[2] + radius * Math.sin(angle),
          ],
        },
      });
    },
  };
};
