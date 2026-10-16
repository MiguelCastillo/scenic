import {mat4} from "@scenic/math";
import {CameraSystem} from "@scenic/camera";
import {Node} from "@scenic/scene";

import {createFrameRateCounter} from "./fps-counter.js";

const worldViewportID = "world";
const axisGizmoID = "axis gizmo";

// SceneRunner steps a scene loaded by loadScene a frame at a time: it keeps
// the scene's clock, pauses it, moves its cameras, gives its scripts the
// player's input, draws it, and tells the app its HUD text and frame rate. It
// doesn't run on its own, and nothing in it touches the DOM: the app owns the
// canvas size and input events, and drives the scene through it, with a
// render loop calling its updateScene and renderFrame every frame (see
// startRenderLoop).
//
// Its API:
// - Each frame: updateScene(ms), then renderFrame(ms).
// - Input: cameras (see CameraSystem in @scenic/camera), setHeldKeys(keys)
//   and addMouseMovement(x, y).
// - Pausing: togglePause(), which returns whether it is now paused, and
//   isPaused().
// - Telling the app: registerHudUpdater(cb) and
//   registerRefreshRateUpdater(cb).
// - sceneManager, the scene's.
//
// Options:
// - paused: whether the scene starts paused, so that it doesn't run until
//   the app resumes it, such as a game waiting for the player to click to
//   play. true by default.
export class SceneRunner {
  constructor(gl, {sceneManager}, {paused = true} = {}) {
    this._gl = gl;
    this.sceneManager = sceneManager;

    // The world viewport's cameras, which the app forwards the player's
    // input to (see CameraSystem in @scenic/camera).
    this.cameras = new CameraSystem(sceneManager, worldViewportID);

    this._getFrameRate = createFrameRateCounter();
    this._lastFrameMs = null;
    this._frameSeconds = 0;

    // While the scene is paused its clock stops: scripts get no time and no
    // input, and animations hold still. The cameras keep responding, and the
    // app lets the mouse look around even where it is left to the scene,
    // such as to orbit a rocket. Edits to the scene still show. Resuming puts
    // the camera back where the scene config starts it, such as behind what
    // it follows.
    // sceneMs is the scene's own clock, which only runs while it isn't
    // paused.
    this._paused = paused;
    this._sceneMs = null;

    // The keys being held down, by KeyboardEvent.code, which scripts get as
    // `keys` every frame. The app sets them with setHeldKeys.
    this._heldKeys = new Set();

    // How far the mouse has moved since the last frame, in pixels, which
    // scripts get as `mouse`, {x, y}, every frame. Positive y is down. The
    // app adds to it with addMouseMovement.
    this._mouseMovement = {x: 0, y: 0};

    this._lastFps = 0;
    this._refreshRateUpdater = () => {};

    // Any node can show text over the scene with "hud" in its state, {text},
    // such as a race's lap and time (see scripts/race.js). The app is told
    // the text of all of them, a blank line apart, whenever it changes.
    this._lastHud = null;
    this._hudUpdater = () => {};
  }

  // This is the logic for updating the scene state and the scene graph with
  // the new scene state. This is the logic for the game itself.
  updateScene(ms) {
    const {sceneManager, cameras} = this;

    // Seconds since the last frame, capped so that the camera does not jump
    // after the page has been in the background and frames were paused.
    const seconds = this._lastFrameMs === null ? 0 : Math.min((ms - this._lastFrameMs) / 1000, 0.1);
    this._lastFrameMs = ms;
    this._frameSeconds = this._paused ? 0 : seconds;
    this._sceneMs = this._sceneMs === null ? ms : this._sceneMs + this._frameSeconds * 1000;

    cameras.update(seconds);

    // The axis gizmo shows the world's axes as the camera sees them, so it is
    // rotated by the inverse of the camera's rotation. The inverse of a
    // rotation matrix is its transpose.
    const {rotation} = sceneManager.getNodeStateByID(cameras.activeCamera.id).transform;
    const cameraRotation = mat4.rotate(mat4.identity(), ...rotation);
    const axisGizmoState = sceneManager.getNodeStateByID(axisGizmoID);
    sceneManager.updateNodeStateByID(axisGizmoID, {
      transform: {
        ...axisGizmoState.transform,
        rotation: mat4.rotationAngles(mat4.transpose(cameraRotation)),
      },
    });
  }

  renderFrame(ms) {
    const {sceneManager} = this;
    const paused = this._paused;

    // Scripts get the frame's seconds, the held keys and the mouse's
    // movement, so that a script such as a flight controller can move at the
    // same speed at any frame rate and respond to the player.
    sceneManager.render(this._sceneMs ?? ms, this._gl, {
      seconds: this._frameSeconds,
      keys: paused ? new Set() : this._heldKeys,
      mouse: paused ? {x: 0, y: 0} : this._mouseMovement,
    });
    this._mouseMovement = {x: 0, y: 0};

    const hud = Node.findChildrenByType(sceneManager.scene, Node)
      .map((node) => sceneManager.getNodeStateByID(node.id)?.hud?.text)
      .filter(Boolean)
      .join("\n\n");
    if (hud !== this._lastHud) {
      this._lastHud = hud;
      this._hudUpdater(hud);
    }

    // Let's write out the number of frames per second that we are able to
    // render.
    const {frameRate, elapsedMs} = this._getFrameRate(ms);
    if (elapsedMs > 1000 && this._lastFps !== frameRate) {
      this._lastFps = frameRate;
      this._refreshRateUpdater(frameRate);
    }
  }

  registerRefreshRateUpdater(cb) {
    this._refreshRateUpdater = cb;
  }

  registerHudUpdater(cb) {
    this._hudUpdater = cb;
    this._lastHud = null;
  }

  setHeldKeys(keys) {
    this._heldKeys = new Set(keys);
  }

  addMouseMovement(x, y) {
    this._mouseMovement = {x: this._mouseMovement.x + x, y: this._mouseMovement.y + y};
  }

  togglePause() {
    this._paused = !this._paused;
    if (!this._paused) {
      this.cameras.reset();
    }
    return this._paused;
  }

  isPaused() {
    return this._paused;
  }
}
