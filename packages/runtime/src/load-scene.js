//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

import {mat4} from "@scenic/math";
import {renderStats, webgl} from "@scenic/renderer";
import {CameraSystem} from "@scenic/camera";
import {Node} from "@scenic/scene";

import {createScene, buildDefaultState} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {applyShaders} from "./shader-registry.js";
import {loadScripts} from "./script-loader.js";
import {startRenderLoop} from "./render-loop.js";

import {createFrameRateCounter} from "./fps-counter.js";

const worldViewportID = "world";
const axisGizmoID = "axis gizmo";

// Helper function for providing the ability to update a scene and to also
// render it. Nothing in here touches the DOM; the app owns the canvas size and
// input events and drives the scene through the functions returned here.
function createSceneUpdater(gl, sceneManager, startPaused) {
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
    // What the last frame drew is kept for anything that shows it, such as
    // a terrain with showTiles, and this frame's drawing is counted afresh.
    renderStats.startFrame();

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

// loadScene builds a scene from its config, loads its models, shaders and
// scripts, and starts rendering it every frame, with its cameras and the
// player's input. It is what an app built on the runtime calls to run a
// scene, and it returns what the app needs to drive it, such as forwarding
// input or pausing it.
//
// Options:
// - sceneURL: where config came from, such as "/games/bubble-squadron/
//   race.json", which the scene's script paths are relative to. The app's
//   page by default.
// - paused: whether the scene starts paused, so that it doesn't run until
//   the app resumes it, such as a game waiting for the player to click to
//   play. true by default.
export const loadScene = async (
  gl,
  config,
  {sceneURL = self.location.href, paused = true} = {}
) => {
  const {vendor, renderer, limits, contextAttributes} = webgl.getDebugData(gl);

  // eslint-disable-next-line no-console
  console.log("Vendor:", vendor);
  // eslint-disable-next-line no-console
  console.log("Renderer:", renderer);
  // eslint-disable-next-line no-console
  console.log("Limits:", JSON.stringify(limits));
  // eslint-disable-next-line no-console
  console.log("Context:", JSON.stringify(contextAttributes));

  const start = Date.now();

  const sceneConfig = buildDefaultState(config);

  // Let's create the scene, which is made up of a scene manager and a
  // state manager.
  const sceneManager = createScene(sceneConfig);

  // Initialize every node's world matrix, so scripts see where everything is
  // on their first frame.
  Node.findChildrenByType(sceneManager.scene, Node).forEach((node) =>
    Node.prototype.preRender.call(node, {sceneManager})
  );

  // API for loading resources for scene nodes.
  const resourceLoader = createResourceLoader(gl, sceneManager);

  // Two functions to update the scene state and another for actually render
  // the scene based on the updated scene state.
  const {
    updateScene,
    renderFrame,
    registerRefreshRateUpdater,
    registerHudUpdater,
    cameras,
    setHeldKeys,
    addMouseMovement,
    togglePause,
    isPaused,
  } = createSceneUpdater(gl, sceneManager, paused);

  // This starts the render loop to render the scene!
  const stopRenderLoop = startRenderLoop(gl, updateScene, renderFrame);

  // dispose tears down everything this call set up, including the GPU
  // resources of every node in the scene, so that another scene can be
  // rendered in its place.
  let disposed = false;
  function dispose() {
    disposed = true;
    stopRenderLoop();
    resourceLoader.dispose();
    sceneManager.dispose(gl);
  }

  try {
    // Renderables that are not loaded from a resource, such as grids, get
    // their shader programs now. The resource loader gives the others theirs
    // once their models are built.
    await Promise.all([
      resourceLoader.loadMany(getResourcesFromConfig(sceneConfig)),
      applyShaders(gl, sceneManager.scene, () => disposed),
      loadScripts(sceneManager, new URL(sceneURL, self.location.href).href),
    ]);
  } catch (ex) {
    // The caller never receives dispose when loading fails, so tear down
    // here; otherwise the render loop would keep running.
    dispose();
    throw ex;
  }

  // eslint-disable-next-line
  console.log(`Load time: ${(Date.now() - start) / 1000} secs`);

  return {
    resourceLoader,
    sceneManager,
    registerRefreshRateUpdater,
    registerHudUpdater,
    cameras,
    setHeldKeys,
    addMouseMovement,
    togglePause,
    isPaused,
    dispose,
  };
};
