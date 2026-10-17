// turntable turns its node slowly around its up axis, like a ship on a
// turntable in a showroom, so the player sees what is on it from every side.
// What is on it goes under its node, so it turns in place, and anything that
// moves on its own, such as a hovering ship, keeps moving. It turns by the
// frame's seconds, so at the same speed at any frame rate, and stops while
// the scene is paused.
//
// Its settings come from "script.settings" in the node's config:
// - speed: how fast it turns, in degrees per second, positive to the left.
//   20 by default.
//
// How far it has turned is written to its settings every frame, so a saved
// state turns on from where it was:
// - angle: how far it has turned, in degrees around its up axis. Its node's
//   Y rotation on the first frame by default.

module.exports = function createTurntableScript(node) {
  return {
    update({seconds = 0, sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings || {};
      const {speed = 20} = settings;
      const [x, y, z] = state.transform.rotation;
      const angle = ((settings.angle ?? y) + speed * seconds) % 360;

      sceneManager.updateNodeStateByID(node.id, {
        transform: {...state.transform, rotation: [x, angle, z]},
        script: {...state.script, settings: {...settings, angle}},
      });
    },
  };
};
