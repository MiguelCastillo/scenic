import {vec3} from "@scenic/math";

// createFreeFlyBehavior flies a camera freely through the scene, like a
// drone: it turns in place, and moves forward, sideways, up and down. It
// changes the camera's transform in the state manager. getCamera returns the
// camera to fly, so the behavior always follows the viewport's active camera.
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
// How it flies comes from the "camera" block of the camera's node in the scene
// config:
// - speed: how fast it flies, in scene units per second.
// - maxPitch: how far up or down it can look, in degrees. Looking straight up
//   or down would flip it over, so keep this under 90.
export function createFreeFlyBehavior(sceneManager, getCamera) {
  const getCameraState = () => sceneManager.getNodeStateByID(getCamera().id);
  const setCameraTransform = (transform) => {
    sceneManager.updateNodeStateByID(getCamera().id, {
      transform: {...getCameraState().transform, ...transform},
    });
  };

  // turn turns the camera from wherever it is currently pointing.
  // - rightDegrees: how far to turn sideways. Positive turns right, negative
  //   turns left.
  // - upDegrees: how far to tilt. Positive tilts up, negative tilts down. The
  //   tilt stops at the camera's maxPitch.
  // Turning right lowers the yaw, because a positive yaw turns the camera to
  // its left (counterclockwise when seen from above).
  function turn(rightDegrees, upDegrees) {
    const {transform, camera} = getCameraState();
    const [pitch, yaw] = transform.rotation;
    const newPitch = Math.max(-camera.maxPitch, Math.min(camera.maxPitch, pitch + upDegrees));
    setCameraTransform({rotation: [newPitch, yaw - rightDegrees, 0]});
  }

  // move moves the camera by the given distances, in scene units: forward
  // along where it is looking, right to its side, and up along the world's
  // up. Negative distances go the other way.
  //
  // Forward and right come from the camera's world matrix, which is updated
  // once per frame in preRender. A move made right after a turn, before the
  // next frame, still goes the way the camera faced on the last frame.
  function move(forwardDistance, rightDistance, upDistance) {
    // The camera's local right [1, 0, 0] and forward [0, 0, -1] in world
    // space. Multiplying the world matrix by those picks out its first column
    // and its third column negated. Matrix4 data is row-major, so a column is
    // every fourth value.
    const m = getCamera().worldMatrix.data;
    const right = [m[0], m[4], m[8]];
    const forward = [-m[2], -m[6], -m[10]];

    // The world's up rather than the camera's. To move along the camera's own
    // up instead, which tilts with its pitch, use its second column:
    // const up =[m[1], m[5], m[9]];
    const up = [0, 1, 0];

    let position = getCameraState().transform.position;
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
    setCameraTransform({position});
  }

  // setMovement sets which way the camera keeps flying, at its speed, until
  // it is set again. It is for input that is held down, such as keys. Each of
  // forward, right and up is -1, 0 or 1.
  let movement = {forward: 0, right: 0, up: 0};
  function setMovement(newMovement) {
    movement = newMovement;
  }

  // update moves the camera by the movement set with setMovement, for the
  // given number of seconds since the last frame.
  function update(seconds) {
    const {forward, right, up} = movement;
    if (forward || right || up) {
      const distance = getCameraState().camera.speed * seconds;
      move(forward * distance, right * distance, up * distance);
    }
  }

  return {turn, move, setMovement, update};
}
