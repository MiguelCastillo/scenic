import {mat4} from "@scenic/math";
import {createTargetFinder} from "./target.js";

// createFirstPersonBehavior looks out from a node in the scene, such as a
// character's head bone, so the view moves exactly as that node does,
// animation included. The mouse looks around from there, and the camera
// cannot move on its own: move and setMovement do nothing. getCamera returns
// the camera to place, so the behavior always follows the viewport's active
// camera.
//
// Every frame, the camera's world transform is the target node's world
// transform, then the offset, then the look angles. The result is written to
// the camera's transform in the state manager.
//
// Its settings come from "firstPerson" in the "camera" block of the camera's
// node in the scene config:
// - target: the node to look out from, such as a character's head bone, as
//   {"nodeID": ..., "boneName": ...} (see target.js).
// - offset: where the camera sits relative to the target, in the target's own
//   coordinates, as {"position": [x, y, z], "rotation": [x, y, z]}. The camera
//   looks down its own -Z axis, so a target whose front is its +Z needs a
//   rotation of [0, 180, 0] to look the same way.
// - maxPitch: how far up or down it can look, in degrees, from where the
//   target is facing.
export function createFirstPersonBehavior(sceneManager, getCamera) {
  const getSettings = () => sceneManager.getNodeStateByID(getCamera().id).camera.firstPerson;

  const findTarget = createTargetFinder(sceneManager);

  // The look angles are [pitch, yaw] in degrees, relative to where the target
  // is facing. They start at 0, so a newly created behavior looks straight
  // ahead.
  let look = [0, 0];

  // turn looks around from the target, with the same signs as free-fly: a
  // positive rightDegrees looks right and a positive upDegrees looks up.
  function turn(rightDegrees, upDegrees) {
    const {maxPitch} = getSettings();
    const [pitch, yaw] = look;
    look = [Math.max(-maxPitch, Math.min(maxPitch, pitch + upDegrees)), yaw - rightDegrees];
  }

  function move() {}
  function setMovement() {}

  function update() {
    const node = findTarget(getSettings().target);
    if (!node) {
      return;
    }

    const {offset} = getSettings();
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

    const {transform} = sceneManager.getNodeStateByID(getCamera().id);
    sceneManager.updateNodeStateByID(getCamera().id, {
      transform: {...transform, position, rotation: mat4.rotationAngles(rotation)},
    });
  }

  return {turn, move, setMovement, update};
}
