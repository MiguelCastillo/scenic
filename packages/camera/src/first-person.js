import {mat4} from "@scenic/math";
import {findTarget} from "./target.js";

// firstPerson looks out from a node in the scene through a
// "first-person-camera", such as from a character's head bone, so the view
// moves exactly as that node does, animation included. The mouse looks around
// from there, and the camera cannot move on its own: move and setMovement do
// nothing. It keeps nothing itself: it reads the camera's state and writes
// back to it.
//
// Every frame, the camera's world transform is the target node's world
// transform, then the offset, then the look angles. The result is written to
// the camera's transform in the state manager.
//
// Its settings are the camera's "firstPerson" block:
// - target: the node to look out from, such as a character's head bone, as
//   {"nodeID": ..., "boneName": ...} (see target.js).
// - offset: where the camera sits relative to the target, in the target's own
//   coordinates, as {"position": [x, y, z], "rotation": [x, y, z]}. The camera
//   looks down its own -Z axis, so a target whose front is its +Z needs a
//   rotation of [0, 180, 0] to look the same way.
// - maxPitch: how far up or down it can look, in degrees, from where the
//   target is facing.
// - look: where it is looking, as [pitch, yaw] in degrees, from where the
//   target is facing. Optional, [0, 0] by default, which looks straight ahead.
export const firstPerson = {
  stateKey: "firstPerson",

  // turn looks around from the target, with the same signs as free-fly: a
  // positive rightDegrees looks right and a positive upDegrees looks up.
  turn(sceneManager, camera, rightDegrees, upDegrees) {
    const {firstPerson} = sceneManager.getNodeStateByID(camera.id);
    const {maxPitch, look: [pitch, yaw] = [0, 0]} = firstPerson;
    const look = [Math.max(-maxPitch, Math.min(maxPitch, pitch + upDegrees)), yaw - rightDegrees];
    sceneManager.updateNodeStateByID(camera.id, {firstPerson: {...firstPerson, look}});
  },

  move() {},
  setMovement() {},

  // moveForFrame moves the camera to its target's offset, looking where the
  // target faces, turned by its look.
  moveForFrame(sceneManager, camera) {
    const {transform, firstPerson} = sceneManager.getNodeStateByID(camera.id);
    const node = findTarget(sceneManager, firstPerson.target);
    if (!node) {
      return;
    }

    const {offset, look = [0, 0]} = firstPerson;
    const matrix = node.worldMatrix
      .multiply(mat4.Matrix4.trs(offset.position, offset.rotation, [1, 1, 1]))
      .multiply(mat4.Matrix4.rotate(look[0], look[1], 0));

    // Matrix4 data is row-major, so the position is the last column. The
    // rotation is the upper 3x3 with each column scaled back to length 1, in
    // case the target or its parents are scaled.
    const m = matrix.data;
    const position = [m[3], m[7], m[11]];
    const rotation = mat4.identity();
    for (const column of [0, 1, 2]) {
      const length = Math.hypot(m[column], m[4 + column], m[8 + column]);
      for (const row of [0, 1, 2]) {
        rotation[row * 4 + column] = m[row * 4 + column] / length;
      }
    }

    sceneManager.updateNodeStateByID(camera.id, {
      transform: {...transform, position, rotation: mat4.rotationAngles(rotation)},
    });
  },

  // reset is state, the camera's "firstPerson" block, with the look angles
  // put back to originalState's, the block in the scene config.
  reset(state, originalState) {
    return {...state, look: originalState.look};
  },
};
