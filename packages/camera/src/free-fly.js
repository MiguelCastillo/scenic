import {vec3} from "@scenic/math";

// freeFly flies a "free-fly-camera" freely through the scene, like a drone:
// it turns in place, and moves forward, sideways, up and down. It keeps
// nothing itself: it reads the camera's state and writes back to it.
//
// The camera's rotation is [pitch, yaw, 0] in degrees. Yaw turns it left and
// right around the world's Y axis, and pitch tilts it up and down. It never
// rolls, so its horizon stays level. (Node transforms build rotations as
// Rz * Ry * Rx, which here is a yaw applied after a pitch.)
//
// Moving uses two frames of reference. Forward and right follow the camera,
// so flying forward goes where it is looking. Up follows the world, which is
// Y-up, so flying up or down only changes altitude.
//
// Its settings are the camera's "freeFly" block:
// - speed: how fast it flies, in scene units per second.
// - maxPitch: how far up or down it can look, in degrees. Looking straight up
//   or down would flip it over, so keep this under 90.
// - movement: which way it keeps flying while input is held down, such as
//   keys, as {forward, right, up}, each -1, 0 or 1. Optional; it stays still
//   without it.
export const freeFly = {
  stateKey: "freeFly",

  // turn turns the camera from wherever it is currently pointing.
  // - rightDegrees: how far to turn sideways. Positive turns right, negative
  //   turns left.
  // - upDegrees: how far to tilt. Positive tilts up, negative tilts down. The
  //   tilt stops at the camera's maxPitch.
  // Turning right lowers the yaw, because a positive yaw turns the camera to
  // its left (counterclockwise when seen from above).
  turn(sceneManager, camera, rightDegrees, upDegrees) {
    const {transform, freeFly} = sceneManager.getNodeStateByID(camera.id);
    const [pitch, yaw] = transform.rotation;
    const newPitch = Math.max(-freeFly.maxPitch, Math.min(freeFly.maxPitch, pitch + upDegrees));
    sceneManager.updateNodeStateByID(camera.id, {
      transform: {...transform, rotation: [newPitch, yaw - rightDegrees, 0]},
    });
  },

  // move moves the camera by the given distances, in scene units: forward
  // along where it is looking, right to its side, and up along the world's
  // up. Negative distances go the other way.
  //
  // Forward and right come from the camera's world matrix, which is updated
  // once per frame in preRender. A move made right after a turn, before the
  // next frame, still goes the way the camera faced on the last frame.
  move(sceneManager, camera, forwardDistance, rightDistance, upDistance) {
    // The camera's local right [1, 0, 0] and forward [0, 0, -1] in world
    // space. Multiplying the world matrix by those picks out its first column
    // and its third column negated. Matrix4 data is row-major, so a column is
    // every fourth value.
    const m = camera.worldMatrix.data;
    const right = [m[0], m[4], m[8]];
    const forward = [-m[2], -m[6], -m[10]];

    // The world's up rather than the camera's. To move along the camera's own
    // up instead, which tilts with its pitch, use its second column:
    // const up =[m[1], m[5], m[9]];
    const up = [0, 1, 0];

    const {transform} = sceneManager.getNodeStateByID(camera.id);
    let position = transform.position;
    position = vec3.add(
      position,
      forward.map((v) => v * forwardDistance)
    );
    position = vec3.add(
      position,
      right.map((v) => v * rightDistance)
    );
    position = vec3.add(
      position,
      up.map((v) => v * upDistance)
    );
    sceneManager.updateNodeStateByID(camera.id, {transform: {...transform, position}});
  },

  // setMovement sets which way the camera keeps flying, at its speed, until
  // it is set again.
  setMovement(sceneManager, camera, movement) {
    const {freeFly} = sceneManager.getNodeStateByID(camera.id);
    sceneManager.updateNodeStateByID(camera.id, {freeFly: {...freeFly, movement}});
  },

  // update moves the camera by its movement, for the given number of seconds
  // since the last frame.
  update(sceneManager, camera, seconds) {
    const {freeFly} = sceneManager.getNodeStateByID(camera.id);
    const {forward = 0, right = 0, up = 0} = freeFly.movement || {};
    if (forward || right || up) {
      const distance = freeFly.speed * seconds;
      this.move(sceneManager, camera, forward * distance, right * distance, up * distance);
    }
  },

  // reset is state, the camera's "freeFly" block, with what free flying
  // changes put back. It only moves the camera's transform, so the block
  // stays as it is.
  reset(state) {
    return state;
  },
};
