// spin turns its node around its own Z axis, such as a fighter's spinner, the
// parts that turn around its length (see bin/generate-starfighter.js). It
// turns faster the harder its engine burns: with the throttle in the script
// settings of the nearest node above it that has one, as a flame follows it
// (see flame.js), so it idles at cruising and whirls when boosting.
//
// Its settings come from "script.settings" in the node's config, and all are
// optional:
// - idleSpeed: how fast it turns at no throttle, in degrees per second. 60
//   by default.
// - speed: how fast it turns at full throttle, in degrees per second. 720 by
//   default.
// - throttle: how hard its engine burns, 0 to 1, when it has a throttle of
//   its own rather than following one above it. 1 without either.
//
// How far it has turned is written to its settings every frame, as angle, in
// degrees, so a saved state turns on from where it was. It moves forward by
// the frame's `seconds`, so it turns at the same speed at any frame rate, and
// stops while the scene is paused.

module.exports = function createSpinScript(node) {
  return {
    preRender({seconds = 0, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings || {};
      const {idleSpeed = 60, speed = 720, angle = 0} = settings;

      let found = settings.throttle;
      for (let parent = node.parent; found == null && parent; parent = parent.parent) {
        found = sceneManager.getNodeStateByID(parent.id)?.script?.settings?.throttle;
      }
      const throttle = Math.min(Math.max(found ?? 1, 0), 1);

      const turned = (angle + (idleSpeed + (speed - idleSpeed) * throttle) * seconds) % 360;
      const [x, y] = state.transform.rotation;
      sceneManager.updateNodeStateByID(node.id, {
        transform: {...state.transform, rotation: [x, y, turned]},
        script: {...state.script, settings: {...settings, angle: turned}},
      });
    },
  };
};
