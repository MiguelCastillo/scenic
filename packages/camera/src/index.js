import {CameraSystem} from "./camera-system.js";
import {freeFly} from "./free-fly.js";
import {firstPerson} from "./first-person.js";
import {thirdPerson} from "./third-person.js";
import {findTarget} from "./target.js";

// CameraSystem runs a viewport's cameras and moves the active one by its type
// (see camera-system.js). Each type of camera that moves has a behavior: an
// object of functions that read the camera's state and write back to it, so
// that every type of camera is driven the same way. Each takes the scene
// manager and the camera node first:
// - turn(rightDegrees, upDegrees): turn in response to looking around, such as
//   moving the mouse.
// - move(forward, right, up): move once by the given distances in scene units,
//   such as for scrolling.
// - setMovement({forward, right, up}): keep moving while input is held down,
//   such as keys. Each value is -1, 0 or 1.
// - moveForFrame(seconds): move for a frame, the seconds since the last one,
//   such as following a target or flying on.
// A behavior also has stateKey, the block of the camera's state it reads,
// and reset(state, originalState), which is that block with what the
// behavior changes as it is used put back to originalState's, the block in
// the scene config.
export {CameraSystem, freeFly, firstPerson, thirdPerson, findTarget};
