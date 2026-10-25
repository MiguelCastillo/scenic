import {step} from "./step.js";

// stepBodies moves every node whose state has a "body" forward seconds in
// time (see step). For each one, it works out the body's new velocity, saves
// it in the body, and moves the node's transform.position by how far the
// body went.
//
// A body is {mass, velocity, force, drag}. velocity and force are [x, y, z],
// [0, 0, 0] by default, and drag is 0 by default. Scripts change them, such
// as a flap's force, and take a node's body away to stop moving it, such as
// while it stands on something.
//
// Gravity is the "gravity" in the state of the nearest node above the body
// that has one, such as the scene's viewport, as [x, y, z]. Without one,
// nothing pulls it. The body moves in its parent's space, so its parent
// shouldn't be turned or scaled.
//
// SceneRunner runs it at the end of each frame, after the frame is worked out
// for drawing (see stepFrame in @scenic/runtime), so everything drawn in a
// frame is from the same state. Scripts see where it moved bodies next frame.
export function stepBodies(sceneManager, seconds) {
  if (!seconds) {
    return;
  }
  for (const [id, state] of Object.entries(sceneManager.stateManager.getAllItemsByName())) {
    const {body} = state;
    if (!body) {
      continue;
    }
    const moved = step(
      {mass: body.mass, velocity: body.velocity ?? [0, 0, 0]},
      {gravity: gravityAbove(sceneManager, id), force: body.force, drag: body.drag},
      seconds
    );
    const position = state.transform.position.map((v, i) => v + moved.offset[i]);
    sceneManager.updateNodeStateByID(id, {
      body: {...body, velocity: moved.velocity},
      transform: {...state.transform, position},
    });
  }
}

// gravityAbove returns the "gravity" of the nearest node above the node id
// that has one, or [0, 0, 0] when none does.
function gravityAbove(sceneManager, id) {
  for (let node = sceneManager.getNodeByID(id)?.parent; node; node = node.parent) {
    const gravity = node.id != null && sceneManager.getNodeStateByID(node.id)?.gravity;
    if (gravity) {
      return gravity;
    }
  }
  return [0, 0, 0];
}
