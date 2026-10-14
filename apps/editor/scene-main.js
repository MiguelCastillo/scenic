//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

// This will inject buffering into `console` so that we can access it later.
import "./logging.js";

import {mat4} from "@scenic/math";
import {webgl} from "@scenic/renderer";
import {cameraModes} from "@scenic/camera";

import {createScene, buildDefaultState} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {applyShaders} from "./shader-registry.js";
import {loadScripts} from "./script-loader.js";
import {startRenderLoop} from "./render-loop.js";

import {createFrameRateCounter} from "./fps-counter.js";

const worldViewportID = "world";
const axisGizmoID = "axis gizmo";

// The camera mode a camera uses when it has no other.
const defaultCameraMode = "free-fly";

// Helper function for providing the ability to update a scene and to also
// render it. Nothing in here touches the DOM; the app owns the canvas size and
// input events and drives the scene through the functions returned here.
function createSceneUpdater(gl, sceneManager) {
  const getFrameRate = createFrameRateCounter();

  const getCamera = () => sceneManager.getNodeByID(worldViewportID).activeCamera;

  // A camera behavior from @scenic/camera decides how the world viewport's
  // active camera responds to the player's input (see that package's index.js
  // for the calls every behavior provides). Which behavior is in use is the camera mode, set by `cameraMode` in the
  // world viewport's state. When the mode is missing, unknown, or one the
  // active camera has no settings for, the camera uses free-fly. A new
  // behavior is created whenever the mode changes, so each mode starts fresh.
  const getCameraModes = () => {
    const settings = sceneManager.getNodeStateByID(getCamera().id).camera;
    return Object.keys(cameraModes).filter((mode) => settings[cameraModes[mode].settingsKey]);
  };

  let cameraMode = null;
  let cameraBehavior = null;
  function getCameraBehavior() {
    const mode = sceneManager.getNodeStateByID(worldViewportID).cameraMode;
    const nextMode = getCameraModes().includes(mode) ? mode : defaultCameraMode;
    if (nextMode !== cameraMode) {
      cameraMode = nextMode;
      cameraBehavior = cameraModes[nextMode].createBehavior(sceneManager, getCamera);
    }
    return cameraBehavior;
  }

  // toggleCameraMode switches the world viewport to the next camera mode the
  // active camera has settings for, going back to the first after the last.
  function toggleCameraMode() {
    getCameraBehavior();
    const modes = getCameraModes();
    const next = modes[(modes.indexOf(cameraMode) + 1) % modes.length];
    sceneManager.updateNodeStateByID(worldViewportID, {cameraMode: next});
  }

  // getCameraControls returns which camera the controls fly and the camera
  // mode they fly it in: the mode actually in use, after falling back to
  // free-fly, rather than what the viewport's state asks for.
  function getCameraControls() {
    getCameraBehavior();
    return {cameraID: getCamera().id, mode: cameraMode};
  }

  let lastFrameMs = null;
  let frameSeconds = 0;

  // The keys being held down, by KeyboardEvent.code, which scripts get as
  // `keys` every frame. The app sets them with setHeldKeys.
  let heldKeys = new Set();

  // This is the logic for updating the scene state and the scene graph with the
  // new scene state. This is the logic for the game itself.
  function updateScene(ms) {
    // Seconds since the last frame, capped so that the camera does not jump
    // after the page has been in the background and frames were paused.
    const seconds = lastFrameMs === null ? 0 : Math.min((ms - lastFrameMs) / 1000, 0.1);
    lastFrameMs = ms;
    frameSeconds = seconds;

    getCameraBehavior().update(seconds);

    // The axis gizmo shows the world's axes as the camera sees them, so it is
    // rotated by the inverse of the camera's rotation. The inverse of a
    // rotation matrix is its transpose.
    const {rotation} = sceneManager.getNodeStateByID(getCamera().id).transform;
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

  function renderFrame(ms) {
    // Scripts get the frame's seconds and the held keys, so that a script such
    // as a flight controller can move at the same speed at any frame rate and
    // respond to the player.
    sceneManager.render(ms, gl, {seconds: frameSeconds, keys: heldKeys});

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
    turnCamera: (...args) => getCameraBehavior().turn(...args),
    moveCamera: (...args) => getCameraBehavior().move(...args),
    setCameraMovement: (...args) => getCameraBehavior().setMovement(...args),
    toggleCameraMode,
    getCameraControls,
    setHeldKeys: (keys) => {
      heldKeys = new Set(keys);
    },
  };
}

// renderScene is exported to the global object (window in the browser)
// This is accomplished via the build/bundling process by configuring this
// file as the main entry point with a UMD export. See .pakit-scene.js for
// more details.
export const renderScene = async (gl, config) => {
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

  // API for loading resources for scene nodes.
  const resourceLoader = createResourceLoader(gl, sceneManager);

  // Two functions to update the scene state and another for actually render
  // the scene based on the updated scene state.
  const {
    updateScene,
    renderFrame,
    registerRefreshRateUpdater,
    turnCamera,
    moveCamera,
    setCameraMovement,
    toggleCameraMode,
    getCameraControls,
    setHeldKeys,
  } = createSceneUpdater(gl, sceneManager);

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
      loadScripts(sceneManager),
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
    turnCamera,
    moveCamera,
    setCameraMovement,
    toggleCameraMode,
    getCameraControls,
    setHeldKeys,
    dispose,
  };
};
