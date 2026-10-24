// flap flutters the ling's wings while it flaps: it swings its node's Y
// scale, which tips the wings, built around where they join the ling's back
// (see bin/generate-ling.js), down and up. It flaps along with "flapping",
// 0 or 1, in the script settings of the nearest node above it that has it,
// such as the ling's (see fly.js), and eases between fluttering and holding
// the wings still, spread to glide.
//
// Its settings come from "script.settings" in the node's config, and all are
// optional:
// - rate: how many flaps a second. 12 by default.
// - response: how quickly it starts and stops fluttering, in seconds. 0.1 by
//   default.
//
// How far into a flap it is and how hard it flutters are written to its
// settings every frame, as phase, 0 to 1, and strength, 0 to 1, so a saved
// state flaps on from where it was. It moves forward by the frame's
// `seconds`, so it stops while the scene is paused.

module.exports = function createFlapScript(node) {
  return {
    update({seconds = 0, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings || {};
      const {rate = 12, response = 0.1, phase = 0, strength = 0} = settings;

      let flapping = null;
      for (let parent = node.parent; flapping == null && parent; parent = parent.parent) {
        flapping = sceneManager.getNodeStateByID(parent.id)?.script?.settings?.flapping;
      }

      const ease = response > 0 ? 1 - Math.exp(-seconds / response) : 1;
      const flutter = strength + ((flapping ? 1 : 0) - strength) * ease;
      const turned = (phase + rate * seconds) % 1;
      // At full strength, the wings swing from a little past flat below to
      // well above their glide, where they rest.
      const y = 1 + flutter * (-0.35 + 0.85 * Math.sin(turned * 2 * Math.PI));

      const [x, , z] = state.transform.scale;
      sceneManager.updateNodeStateByID(node.id, {
        transform: {...state.transform, scale: [x, y, z]},
        script: {...state.script, settings: {...settings, phase: turned, strength: flutter}},
      });
    },
  };
};
