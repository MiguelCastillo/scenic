import {createFreeFlyBehavior} from "./free-fly.js";
import {createFirstPersonBehavior} from "./first-person.js";
import {createThirdPersonBehavior} from "./third-person.js";
import {createTargetFinder} from "./target.js";

// A camera behavior decides how a camera responds to the player's input.
// Every behavior is created with (sceneManager, getCamera), where getCamera
// returns the camera to control, and provides the same four calls, so that
// switching how a camera moves means swapping its behavior and nothing else:
// - turn(rightDegrees, upDegrees): turn in response to looking around, such as
//   moving the mouse.
// - move(forward, right, up): move once by the given distances in scene units,
//   such as for scrolling.
// - setMovement({forward, right, up}): keep moving while input is held down,
//   such as keys. Each value is -1, 0 or 1.
// - update(seconds): called every frame with the seconds since the last one.
//
// cameraModes lists the behaviors by mode name, each with the key in a
// camera's "camera" config block that holds its settings. A camera can only
// use the modes it has settings for.
const cameraModes = {
  "free-fly": {createBehavior: createFreeFlyBehavior, settingsKey: "freeFly"},
  "first-person": {createBehavior: createFirstPersonBehavior, settingsKey: "firstPerson"},
  "third-person": {createBehavior: createThirdPersonBehavior, settingsKey: "thirdPerson"},
};

export {
  cameraModes,
  createFreeFlyBehavior,
  createFirstPersonBehavior,
  createThirdPersonBehavior,
  createTargetFinder,
};
