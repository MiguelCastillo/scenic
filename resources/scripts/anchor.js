// anchor keeps its node at the same part of the screen whatever its size, for
// scenes drawn with an orthographic camera, which places things in pixels
// from the bottom left of the screen: a spot in pixels lands in different
// places on a phone and on a desktop, such as behind a menu on one and beside
// it on the other. It places its node at a fraction of the screen's width
// and height, every frame, from the frame's screen, so it follows the screen
// as it is resized. Its node's children are placed from there, so a node
// that moves on its own, such as a hovering ship, goes under it.
//
// Its settings come from "script.settings" in the node's config:
// - x: how far across the screen, from 0 at the left to 1 at the right.
//   0.5 by default.
// - y: how far up the screen, from 0 at the bottom to 1 at the top. 0.5 by
//   default.
// - scale: how big its node is, as its transform's scale. 1 by default.
// - narrow: where it goes, and how big it is, on a narrow screen instead,
//   such as a phone, where things stack rather than sit side by side, and
//   there is less room: {width, x, y, scale}, used on screens narrower than
//   width, in pixels. Optional.
//
// The node keeps its own z, how far from the camera it is.

module.exports = function createAnchorScript(node) {
  return {
    update({screen, sceneManager}) {
      if (!screen) {
        return;
      }
      const state = sceneManager.getNodeStateByID(node.id);
      const {narrow, ...settings} = state.script.settings || {};
      const {
        x = 0.5,
        y = 0.5,
        scale = 1,
      } = narrow && screen.width < narrow.width ? narrow : settings;
      const [, , z] = state.transform.position;
      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          position: [x * screen.width, y * screen.height, z],
          scale: [scale, scale, scale],
        },
      });
    },
  };
};
