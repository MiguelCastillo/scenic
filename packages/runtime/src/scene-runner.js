import {CameraSystem} from "@scenic/camera";
import {Node, Viewport} from "@scenic/scene";

import {createFrameRateCounter} from "./fps-counter.js";

// SceneRunner steps a scene loaded by loadScene a frame at a time: it keeps
// the scene's clock, pauses it, moves its cameras, gives its scripts the
// player's input, draws it, and tells the app its frame rate. It doesn't run
// on its own, and nothing in it touches the DOM: the app owns the canvas
// size and input events, and drives the scene through it, with a
// render loop calling its stepFrame and renderFrame every frame (see
// startRenderLoop).
//
// The player's input goes to the cameras of the viewport the scene marks with
// "input": true in its config, such as its "world" viewport. A scene without
// one, such as a menu, has no cameras for the player to move.
//
// Using it: every frame, call stepFrame once with the frame's time, then
// renderFrame to draw it, after clearing the canvas. startRenderLoop does
// this for you:
//
//   const runner = new SceneRunner(gl, await loadScene(gl, config));
//   requestAnimationFrame(function frame(ms) {
//     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//     runner.stepFrame(ms);
//     runner.renderFrame();
//     requestAnimationFrame(frame);
//   });
//
// The two halves do different jobs:
// - stepFrame moves the scene a frame forward: it works out the frame's
//   seconds since the last one, moves the scene's clock, runs the scripts
//   with those seconds and the input given since the last frame, works out
//   where everything is (see preRender in SceneManager), then moves the
//   active camera, so that a camera following a ship follows where the ship
//   is this frame, then prepares the view from where the camera is (see
//   prepareForView in SceneManager), and tells the app the frame rate. Call
//   it once a frame: calling it again moves the scene again.
// - renderFrame draws the scene where stepFrame left it, and changes
//   nothing, so it can be called as often as needed, such as to draw the
//   same frame into more than one place.
// Input, pausing and registering can happen at any time; the next
// stepFrame picks them up.
//
// Its API:
// - Each frame: stepFrame(ms), then renderFrame(), as often as needed.
// - Input: the player's keys, mouse and wheel, as events the app publishes
//   on sceneManager.input (see SceneManager in @scenic/scene), which
//   stepFrame adds up for the cameras and the scripts. cameras (see
//   CameraSystem in @scenic/camera), or null without an input viewport.
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

    // The keys held down on each input channel, from the keydown and keyup
    // events published on sceneManager.input so far, and which way each
    // channel's player wants the camera to keep flying, from the last move
    // intent.
    this._heldKeysByChannel = new Map();
    this._moveByChannel = new Map();

    this._lastFps = 0;
    this._refreshRateUpdater = () => {};
  }

  // stepFrame moves the scene a frame forward, to ms, the frame's time: its
  // clock, then, through its scripts, everything they move, then where
  // everything is (see preRender in SceneManager), then its active camera,
  // then what is prepared for the view from where the camera is (see
  // prepareForView in SceneManager). This is the logic for the game itself.
  stepFrame(ms) {
    const {sceneManager} = this;
    const paused = this._paused;

    // Seconds since the last frame, capped so that the camera does not jump
    // after the page has been in the background and frames were paused.
    const seconds = this._lastFrameMs === null ? 0 : Math.min((ms - this._lastFrameMs) / 1000, 0.1);
    this._lastFrameMs = ms;
    const sceneSeconds = paused ? 0 : seconds;
    this._sceneMs = this._sceneMs === null ? ms : this._sceneMs + sceneSeconds * 1000;

    // The input events published since the last frame add up to each
    // channel's input this frame: the keys held, the keys that went down,
    // even if they also came up, so a quick tap is never missed, how far the
    // mouse moved and the wheel scrolled, and the player's intents (see
    // input-intents.js in @scenic/dom): how far to look and zoom, which way
    // to fly, how far to move through a menu, and whether to switch cameras,
    // choose, select or go back. A channel for another player in a network
    // game also has the messages the player sent since the last frame, in
    // order, {type: "network", message} events, as messages.
    const eventsByChannel = sceneManager.input.take();
    const input = {};
    for (const channel of new Set([
      ...this._heldKeysByChannel.keys(),
      ...Object.keys(eventsByChannel),
    ])) {
      const keys = new Set(this._heldKeysByChannel.get(channel));
      const pressed = new Set();
      const mouse = {x: 0, y: 0};
      const wheel = {x: 0, y: 0};
      const intents = {
        look: {x: 0, y: 0},
        zoom: 0,
        move: this._moveByChannel.get(channel) ?? {forward: 0, right: 0, up: 0},
        nextCamera: false,
        navigate: {x: 0, y: 0},
        choose: null,
        select: false,
        back: false,
      };
      const messages = [];
      for (const event of eventsByChannel[channel] ?? []) {
        if (event.type === "keydown") {
          keys.add(event.code);
          pressed.add(event.code);
        } else if (event.type === "keyup") {
          keys.delete(event.code);
        } else if (event.type === "mousemove") {
          mouse.x += event.x;
          mouse.y += event.y;
        } else if (event.type === "wheel") {
          wheel.x += event.x;
          wheel.y += event.y;
        } else if (event.type === "look") {
          intents.look.x += event.x;
          intents.look.y += event.y;
        } else if (event.type === "zoom") {
          intents.zoom += event.amount;
        } else if (event.type === "move") {
          intents.move = {forward: event.forward, right: event.right, up: event.up};
        } else if (event.type === "navigate") {
          intents.navigate.x += event.x;
          intents.navigate.y += event.y;
        } else if (event.type === "choose") {
          intents.choose = event.index;
        } else if (["nextCamera", "select", "back"].includes(event.type)) {
          intents[event.type] = true;
        } else if (event.type === "network") {
          messages.push(event.message);
        }
      }
      this._heldKeysByChannel.set(channel, keys);
      this._moveByChannel.set(channel, intents.move);
      input[channel] = {keys, pressed, mouse, wheel, intents, messages};
    }

    // The player's input moves the cameras too, even while paused, when the
    // mouse looks around rather than turns (see CameraSystem in
    // @scenic/camera).
    if (input.player) {
      this.cameras?.applyInput(input.player.intents, {paused});
    }

    // The frame is worked out in steps, in an order set by what depends on
    // what: a camera that follows a node, such as a ship, depends on where
    // the node is this frame, and what is prepared for the view, such as
    // which trees to plant, depends on where the camera is. A camera
    // following where its node was last drawn instead would trail it by a
    // frame's movement, more or less as frames are longer or shorter, and
    // shake it on the screen.
    //
    // 1. Scripts move things, such as the ship. They get the frame's seconds
    // and input, so that a script such as a flight controller can move at the
    // same speed at any frame rate and respond to the player. While paused
    // they get neither, except for the messages other players in a network
    // game sent, who play on, so that what shows them knows where they are.
    // They also get the size of the screen the scene is drawn on, {width,
    // height}, in pixels, such as to place things on it for an orthographic
    // camera, which measures in pixels.
    const {width, height} = this._gl.canvas;
    sceneManager.runScripts(this._sceneMs, {
      screen: {width, height},
      seconds: sceneSeconds,
      input: paused
        ? Object.fromEntries(
            Object.entries(input).map(([channel, {messages}]) => [channel, {messages}])
          )
        : input,
    });

    // 2. Every world matrix is worked out from the new state, so that it is
    // where the scripts moved everything to. Nothing in it depends on the
    // camera.
    sceneManager.preRender(this._sceneMs, this._gl);

    if (this.cameras) {
      // 3. The active camera, the only one that moves, follows its target's
      // new world matrix.
      this.cameras.moveActiveCamera(seconds);

      // 4. The camera, and anything attached to it, are worked out again
      // where it moved to.
      sceneManager.preRenderNode(this.cameras.activeCamera, this._sceneMs, this._gl);
    }

    // 5. What is drawn is prepared for the view from where the camera is
    // now, however far it moved, such as the terrain's tiles and the
    // forest's trees around it. 6, drawing it, is renderFrame's.
    sceneManager.prepareForView(this._sceneMs, this._gl);

    // Let's write out the number of frames per second that we are able to
    // run.
    const {frameRate, elapsedMs} = this._getFrameRate(ms);
    if (elapsedMs > 1000 && this._lastFps !== frameRate) {
      this._lastFps = frameRate;
      this._refreshRateUpdater(frameRate);
    }
  }

  // renderFrame draws the scene where the last stepFrame left it. It
  // changes nothing, so it can draw the same frame as often as needed.
  renderFrame() {
    this.sceneManager.render(this._sceneMs ?? 0, this._gl);
  }

  registerRefreshRateUpdater(cb) {
    this._refreshRateUpdater = cb;
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
