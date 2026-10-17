import {StateManager} from "@scenic/scene";

import {freeFly} from "./free-fly.js";
import {firstPerson} from "./first-person.js";
import {thirdPerson} from "./third-person.js";

// The behavior that moves each type of camera. A plain "camera" has none and
// stays where its transform puts it.
const behaviorsByCameraType = {
  "free-fly-camera": freeFly,
  "first-person-camera": firstPerson,
  "third-person-camera": thirdPerson,
};

// CameraSystem runs a viewport's cameras: which one the viewport looks
// through, and how they respond to the player's input. The app forwards input
// to it and calls moveActiveCamera every frame.
//
// The viewport looks through its active camera, named by `activeCamera` in
// the viewport's state (see Viewport in @scenic/scene). A camera's type says
// how it moves, such as a "third-person-camera" following a rocket, and its
// settings are in the block its behavior reads, such as "thirdPerson". Input
// only reaches the active camera.
//
// It keeps nothing itself. Everything it changes, such as a camera's orbit or
// the way it keeps flying while a key is held, is in the camera's state, so
// switching to another camera and back finds it as it was left, and loading
// a saved state puts every camera back where it was.
//
// A camera's settings can leave the mouse to the scene with "mouseOrbit":
// false, so that it can steer a rocket, say: turn then does nothing, and
// lookAround is for turning it anyway, such as while a game is paused.
//
// Its API is the class's public members, grouped by what they are for:
// - Cameras: viewport, activeCamera, setActiveCamera(name), nextCamera().
// - Input: applyInput(intents, {paused}), a frame's camera intents as a
//   SceneRunner adds them up, and the moves they are made of:
//   turn(rightDegrees, upDegrees),
//   lookAround(rightDegrees, upDegrees), move(forward, right, up),
//   setMovement({forward, right, up}).
// - Every frame: moveActiveCamera(seconds).
// - Resetting: reset().
export class CameraSystem {
  constructor(sceneManager, viewportID) {
    // viewport is the viewport node whose cameras this runs.
    this.viewport = sceneManager.getNodeByID(viewportID);
    this._sceneManager = sceneManager;
  }

  // activeCamera is the camera node the viewport looks through, up to date
  // with the viewport's state.
  get activeCamera() {
    return this.viewport.updateActiveCamera(this._sceneManager).activeCamera;
  }

  // setActiveCamera makes the viewport look through the camera named name.
  setActiveCamera(name) {
    this._sceneManager.updateNodeStateByID(this.viewport.id, {activeCamera: name});
  }

  // nextCamera makes the viewport look through its next camera, going back to
  // the first after the last.
  nextCamera() {
    const {cameras} = this.viewport;
    const next = cameras[(cameras.indexOf(this.activeCamera) + 1) % cameras.length];
    this.setActiveCamera(next.name);
  }

  // applyInput moves the cameras with a frame's camera intents, {look,
  // zoom, move, nextCamera}, whatever device they came from (see
  // input-intents.js in @scenic/dom): it switches to the next camera, keeps
  // the active one flying the way move says, turns it by look, in degrees,
  // or looks around while paused, and moves it closer by zoom.
  applyInput({look, zoom, move, nextCamera}, {paused = false} = {}) {
    if (nextCamera) {
      this.nextCamera();
    }
    this.setMovement(move);
    if (look.x || look.y) {
      if (paused) {
        this.lookAround(look.x, look.y);
      } else {
        this.turn(look.x, look.y);
      }
    }
    if (zoom) {
      this.move(zoom, 0, 0);
    }
  }

  // turn turns the active camera, such as when the mouse moves, unless its
  // settings leave the mouse to the scene.
  turn(rightDegrees, upDegrees) {
    const camera = this.activeCamera;
    const behavior = behaviorsByCameraType[camera.type];
    const state = behavior && this._sceneManager.getNodeStateByID(camera.id)[behavior.stateKey];
    if (behavior && state.mouseOrbit !== false) {
      behavior.turn(this._sceneManager, camera, rightDegrees, upDegrees);
    }
  }

  // lookAround turns the active camera even when its settings leave the mouse
  // to the scene, such as to look around while a game is paused.
  lookAround(rightDegrees, upDegrees) {
    const camera = this.activeCamera;
    behaviorsByCameraType[camera.type]?.turn(this._sceneManager, camera, rightDegrees, upDegrees);
  }

  // move moves the active camera once, such as when scrolling.
  move(forwardDistance, rightDistance, upDistance) {
    const camera = this.activeCamera;
    behaviorsByCameraType[camera.type]?.move(
      this._sceneManager,
      camera,
      forwardDistance,
      rightDistance,
      upDistance
    );
  }

  // setMovement sets which way the active camera keeps moving while input is
  // held down, such as keys. Each of forward, right and up is -1, 0 or 1.
  setMovement(movement) {
    const camera = this.activeCamera;
    behaviorsByCameraType[camera.type]?.setMovement(this._sceneManager, camera, movement);
  }

  // moveActiveCamera moves the active camera for the seconds since the last
  // frame, the way its type moves: a chase camera to behind what it follows,
  // a cockpit camera to its target's cockpit, and a free-fly camera on the
  // way it is flying. It reads where a camera's target is from the target's
  // world matrix, so the app works out where everything is first (see
  // SceneRunner in @scenic/runtime).
  moveActiveCamera(seconds) {
    const camera = this.activeCamera;
    behaviorsByCameraType[camera.type]?.moveForFrame(this._sceneManager, camera, seconds);
  }

  // reset puts what the active camera changes as it is used, such as a
  // third-person camera's orbit and zoom, back to the scene config's values,
  // so the camera goes back behind what it follows. Settings that are only
  // changed by hand, such as lookUp, stay as they are.
  reset() {
    const camera = this.activeCamera;
    const behavior = behaviorsByCameraType[camera.type];
    if (!behavior) {
      return;
    }

    const {stateKey} = behavior;
    const originalState = StateManager.getItemsByID(this._sceneManager.stateManager.getItems())[
      camera.id
    ][stateKey];
    const state = this._sceneManager.getNodeStateByID(camera.id)[stateKey];
    this._sceneManager.updateNodeStateByID(camera.id, {
      [stateKey]: behavior.reset(state, originalState),
    });
  }
}
