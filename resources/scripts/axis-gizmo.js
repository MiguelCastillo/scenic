// axis-gizmo turns its node to show the world's axes as a viewport's camera
// sees them, such as a small set of colored axes in a corner of the screen.
// It turns its node by the inverse of the camera's rotation, which for a
// rotation is its transpose, so the node's own axes line up with the world's
// on screen. It keeps turning while the scene is paused, as the camera can
// still look around.
//
// Its settings come from "script.settings" in the node's config, and all are
// optional:
// - viewport: the ID of the viewport whose active camera it follows. "world"
//   by default.
const {mat4} = require("@scenic/math");

module.exports = function createAxisGizmoScript(node) {
  return {
    preRender({sceneManager}) {
      const state = sceneManager.getNodeStateByID(node.id);
      const {viewport = "world"} = state.script.settings ?? {};
      const camera = sceneManager
        .getNodeByID(viewport)
        ?.updateActiveCamera(sceneManager).activeCamera;
      if (!camera) {
        return;
      }

      const {rotation} = sceneManager.getNodeStateByID(camera.id).transform;
      const cameraRotation = mat4.rotate(mat4.identity(), ...rotation);
      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          rotation: mat4.rotationAngles(mat4.transpose(cameraRotation)),
        },
      });
    },
  };
};
