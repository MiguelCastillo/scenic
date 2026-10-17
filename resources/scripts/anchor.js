// anchor keeps its node at the same part of the screen whatever its size, for
// scenes drawn with an orthographic camera, which places things in pixels
// from the bottom left of the screen: a spot in pixels lands in different
// places on a phone and on a desktop, such as behind a menu on one and beside
// it on the other. It places its node at a fraction of the screen's width
// and height, every frame, from the frame's screen, so it follows the screen
// as it is resized. Its node's children are placed from there, so a node
// that moves on its own, such as a hovering ship, goes under it.
//
// It can also size what is under it to fit a space, such as a showcase that
// shows ships of very different sizes, one at a time: with fit, it scales
// its node so that the models under it reach a part of the screen from it
// at most, whatever their size, and however big the screen is.
//
// Its settings come from "script.settings" in the node's config:
// - x: how far across the screen, from 0 at the left to 1 at the right.
//   0.5 by default.
// - y: how far up the screen, from 0 at the bottom to 1 at the top. 0.5 by
//   default.
// - scale: how big its node is, as its transform's scale. 1 by default.
// - fit: how far the models under it reach from it at most, in any
//   direction, as a fraction of the screen's smaller side, its height on a
//   desktop and its width on a phone, such as 0.28. It sets its scale
//   instead. Optional.
// - beside: a column down the left of the screen, such as a menu, that x
//   is measured beside instead, from the column's right edge, at 0, to the
//   screen's right edge, at 1, so that 0.5 is in the middle of the space
//   the column leaves: {min, width, max}, the column as wide as width of
//   the screen, between min and max pixels, the way the CSS clamp(min,
//   width, max) sizes it. Optional.
// - narrow: where it goes, and how big it is, on a narrow screen instead,
//   such as a phone, where things stack rather than sit side by side, and
//   there is less room: {width, x, y, scale, fit}, used on screens narrower
//   than width, in pixels. Optional.
//
// The node keeps its own z, how far from the camera it is.
//
// How far the models under it reach is measured when they change, such as
// when another ship is put on it, and written to its settings, so that what
// moves under it, such as a ship bobbing, doesn't change its size:
// - reach: {models, distance}, the ids of the models it measured, and how far
//   they reach from it at its scale of 1.

const {boundingSphere, Geometry} = require("@scenic/scene");

// reach is how far the models under node reach from it, at its scale of 1,
// and their ids, measured through the positions and scales of the nodes in
// between, as their states have them. It leaves out their rotations, which
// for parts placed on a ship, such as its flames, are as good as none.
function reach(node, sceneManager) {
  const models = [];
  let distance = 0;
  const visit = (parent, [x, y, z], scale) => {
    for (const child of parent.items) {
      if (child instanceof Geometry) {
        const {vertexBuffer} = child;
        vertexBuffer.bounds ??= boundingSphere(vertexBuffer.positions.data);
        const {center, radius} = vertexBuffer.bounds;
        const from = [x + center[0] * scale, y + center[1] * scale, z + center[2] * scale];
        distance = Math.max(distance, Math.hypot(...from) + radius * scale);
        models.push(child.parent.id);
        continue;
      }
      const transform = sceneManager.getNodeStateByID(child.id)?.transform;
      const [cx, cy, cz] = transform?.position ?? [0, 0, 0];
      visit(
        child,
        [x + cx * scale, y + cy * scale, z + cz * scale],
        scale * Math.max(...(transform?.scale ?? [1, 1, 1]))
      );
    }
  };
  visit(node, [0, 0, 0], 1);
  return {models: models.join(","), distance};
}

module.exports = function createAnchorScript(node) {
  return {
    update({screen, sceneManager}) {
      if (!screen) {
        return;
      }
      const state = sceneManager.getNodeStateByID(node.id);
      const settings = state.script.settings || {};
      const {narrow} = settings;
      const {
        x = 0.5,
        y = 0.5,
        scale = 1,
        fit,
        beside,
      } = narrow && screen.width < narrow.width ? narrow : settings;

      const smaller = Math.min(screen.width, screen.height);

      // Measure the models under it again only when they change.
      let measured = settings.reach;
      if (fit) {
        const now = reach(node, sceneManager);
        if (now.models !== measured?.models) {
          measured = now;
        }
      }
      const size = fit && measured?.distance > 0 ? (fit * smaller) / measured.distance : scale;

      const column = beside
        ? Math.min(Math.max(beside.width * screen.width, beside.min), beside.max)
        : 0;
      const across = column + x * (screen.width - column);

      const [, , z] = state.transform.position;
      sceneManager.updateNodeStateByID(node.id, {
        transform: {
          ...state.transform,
          position: [across, y * screen.height, z],
          scale: [size, size, size],
        },
        script: {...state.script, settings: {...settings, reach: measured}},
      });
    },
  };
};
