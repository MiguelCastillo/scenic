import {CameraSystem} from "@scenic/camera";
import {Node, Viewport} from "@scenic/scene";

import {createFrameRateCounter} from "./fps-counter.js";

// SceneRunner steps a scene loaded by loadScene a frame at a time: it keeps
// the scene's clock, pauses it, moves its cameras, gives its scripts the
// player's input, draws it, and tells the app its frame rate. It doesn't run
// on its own, and nothing in it touches the DOM: the app owns the canvas
// size and input events, and drives the scene through it, with a
// render loop calling its updateScene and renderFrame every frame (see
// startRenderLoop).
//
// The player's input goes to the cameras of the viewport the scene marks with
// "input": true in its config, such as its "world" viewport. A scene without
// one, such as a menu, has no cameras for the player to move.
//
// Using it: every frame, call updateScene once with the frame's time, then
// renderFrame to draw it, after clearing the canvas. startRenderLoop does
// this for you:
//
//   const runner = new SceneRunner(gl, await loadScene(gl, config));
//   requestAnimationFrame(function frame(ms) {
//     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//     runner.updateScene(ms);
//     runner.renderFrame();
//     requestAnimationFrame(frame);
//   });
//
// The two halves do different jobs:
// - updateScene moves the scene a frame forward: it works out the frame's
//   seconds since the last one, moves the scene's clock and the cameras,
//   runs the scripts with those seconds and the input given since the last
//   frame, and tells the app the frame rate. Call it once a frame:
//   calling it again moves the scene again.
// - renderFrame draws the scene as updateScene left it, and changes nothing,
//   so it can be called as often as needed, such as to draw it again after
//   the canvas is resized, or to draw the same frame into more than one
//   place.
// Input, pausing and registering can happen at any time; the next
// updateScene picks them up.
//
// Its API:
// - Each frame: updateScene(ms), then renderFrame(), as often as needed.
// - Input: cameras (see CameraSystem in @scenic/camera), or null without an
//   input viewport, setHeldKeys(keys) and addMouseMovement(x, y).
// - Pausing: togglePause(), which returns whether it is now paused, and
//   isPaused().
// - Telling the app: registerRefreshRateUpdater(cb). What the scene shows
//   the player, such as a HUD, comes from sceneManager.ui (see SceneManager
//   in @scenic/scene).
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

    // The input viewport's cameras, which the app forwards the player's
    // input to (see CameraSystem in @scenic/camera).
    const inputViewport = Node.findChildrenByType(sceneManager.scene, Viewport).find(
      (viewport) => sceneManager.getNodeStateByID(viewport.id)?.input
    );
    this.cameras = inputViewport ? new CameraSystem(sceneManager, inputViewport.id) : null;

    this._getFrameRate = createFrameRateCounter();
    this._lastFrameMs = null;

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
  }

  // updateScene moves the scene a frame forward, to ms, the frame's time:
  // its clock, its cameras and, through its scripts, everything else. This is
  // the logic for the game itself.
  updateScene(ms) {
    const {sceneManager} = this;
    const paused = this._paused;

    // Seconds since the last frame, capped so that the camera does not jump
    // after the page has been in the background and frames were paused.
    const seconds = this._lastFrameMs === null ? 0 : Math.min((ms - this._lastFrameMs) / 1000, 0.1);
    this._lastFrameMs = ms;
    const sceneSeconds = paused ? 0 : seconds;
    this._sceneMs = this._sceneMs === null ? ms : this._sceneMs + sceneSeconds * 1000;

    this.cameras?.update(seconds);

    // Scripts get the frame's seconds, the held keys and the mouse's
    // movement, so that a script such as a flight controller can move at the
    // same speed at any frame rate and respond to the player.
    sceneManager.update(this._sceneMs, {
      seconds: sceneSeconds,
      keys: paused ? new Set() : this._heldKeys,
      mouse: paused ? {x: 0, y: 0} : this._mouseMovement,
    });
    this._mouseMovement = {x: 0, y: 0};

    // Let's write out the number of frames per second that we are able to
    // run.
    const {frameRate, elapsedMs} = this._getFrameRate(ms);
    if (elapsedMs > 1000 && this._lastFps !== frameRate) {
      this._lastFps = frameRate;
      this._refreshRateUpdater(frameRate);
    }
  }

  // renderFrame draws the scene as the last updateScene left it. It changes
  // nothing, so it can draw the same frame as often as needed.
  renderFrame() {
    this.sceneManager.render(this._sceneMs ?? 0, this._gl);
  }

  registerRefreshRateUpdater(cb) {
    this._refreshRateUpdater = cb;
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
      this.cameras?.reset();
    }
    return this._paused;
  }

  isPaused() {
    return this._paused;
  }
}
