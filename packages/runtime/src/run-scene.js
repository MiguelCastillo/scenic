import {mat4} from "@scenic/math";
import {CameraSystem} from "@scenic/camera";
import {Node} from "@scenic/scene";

import {createFrameRateCounter} from "./fps-counter.js";

const worldViewportID = "world";
const axisGizmoID = "axis gizmo";

// runScene runs a scene loaded by loadScene, a frame at a time: it keeps the
// scene's clock, pauses it, moves its cameras, gives its scripts the
// player's input, draws it, and tells the app its HUD text and frame rate.
// Nothing in here touches the DOM, and nothing calls it on its own: the app
// owns the canvas size and input events, and drives the scene through the
// functions returned here, with a render loop calling updateScene and
// renderFrame every frame (see startRenderLoop).
//
// Options:
// - paused: whether the scene starts paused, so that it doesn't run until
//   the app resumes it, such as a game waiting for the player to click to
//   play. true by default.
export function runScene(gl, {sceneManager}, {paused: startPaused = true} = {}) {
  const getFrameRate = createFrameRateCounter();

  // The world viewport's cameras, which the app forwards the player's input to
  // (see CameraSystem in @scenic/camera).
  const cameras = new CameraSystem(sceneManager, worldViewportID);

  let lastFrameMs = null;
  let frameSeconds = 0;

  // While the scene is paused its clock stops: scripts get no time and no
  // input, and animations hold still. The cameras keep responding, and the
  // app lets the mouse look around even where it is left to the scene, such
  // as to orbit a rocket. Edits to the scene still show. Resuming puts the
  // camera back where the scene config starts it, such as behind what it
  // follows.
  // sceneMs is the scene's own clock, which only runs while it isn't paused.
  let paused = startPaused;
  let sceneMs = null;

  // The keys being held down, by KeyboardEvent.code, which scripts get as
  // `keys` every frame. The app sets them with setHeldKeys.
  let heldKeys = new Set();

  // How far the mouse has moved since the last frame, in pixels, which
  // scripts get as `mouse`, {x, y}, every frame. Positive y is down. The app
  // adds to it with addMouseMovement.
  let mouseMovement = {x: 0, y: 0};

  // This is the logic for updating the scene state and the scene graph with the
  // new scene state. This is the logic for the game itself.
  function updateScene(ms) {
    // Seconds since the last frame, capped so that the camera does not jump
    // after the page has been in the background and frames were paused.
    const seconds = lastFrameMs === null ? 0 : Math.min((ms - lastFrameMs) / 1000, 0.1);
    lastFrameMs = ms;
    frameSeconds = paused ? 0 : seconds;
    sceneMs = sceneMs === null ? ms : sceneMs + frameSeconds * 1000;

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

  let lastFps = 0;
  let refreshRateUpdater = () => {};
  const registerRefreshRateUpdater = (cb) => {
    refreshRateUpdater = cb;
  };

  // Any node can show text over the scene with "hud" in its state, {text},
  // such as a race's lap and time (see scripts/race.js). The app is told
  // the text of all of them, a blank line apart, whenever it changes.
  let lastHud = null;
  let hudUpdater = () => {};
  const registerHudUpdater = (cb) => {
    hudUpdater = cb;
    lastHud = null;
  };

  function renderFrame(ms) {
    // Scripts get the frame's seconds, the held keys and the mouse's
    // movement, so that a script such as a flight controller can move at the
    // same speed at any frame rate and respond to the player.
    sceneManager.render(sceneMs ?? ms, gl, {
      seconds: frameSeconds,
      keys: paused ? new Set() : heldKeys,
      mouse: paused ? {x: 0, y: 0} : mouseMovement,
    });
    mouseMovement = {x: 0, y: 0};

    const hud = Node.findChildrenByType(sceneManager.scene, Node)
      .map((node) => sceneManager.getNodeStateByID(node.id)?.hud?.text)
      .filter(Boolean)
      .join("\n\n");
    if (hud !== lastHud) {
      lastHud = hud;
      hudUpdater(hud);
    }

    // Let's write out the number of frames per second that we are able to
    // render.
    const {frameRate, elapsedMs} = getFrameRate(ms);
    if (elapsedMs > 1000 && lastFps !== frameRate) {
      lastFps = frameRate;
      refreshRateUpdater(frameRate);
    }
  }

  return {
    sceneManager,
    updateScene,
    renderFrame,
    registerRefreshRateUpdater,
    registerHudUpdater,
    cameras,
    setHeldKeys: (keys) => {
      heldKeys = new Set(keys);
    },
    addMouseMovement: (x, y) => {
      mouseMovement = {x: mouseMovement.x + x, y: mouseMovement.y + y};
    },
    togglePause: () => {
      paused = !paused;
      if (!paused) {
        cameras.reset();
      }
      return paused;
    },
    isPaused: () => paused,
  };
}
