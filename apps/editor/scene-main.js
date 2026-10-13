//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

// This will inject buffering into `console` so that we can access it later.
import "./logging.js";

import {mat4} from "@scenic/math";
import {webgl} from "@scenic/renderer";

import {createScene, buildDefaultState} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {loadShaders} from "./shader-factory.js";
import {startRenderLoop} from "./render-loop.js";
import {createFreeFlyBehavior} from "./camera-behaviors/free-fly.js";

import {createFrameRateCounter} from "./fps-counter.js";

const worldViewportID = "world";
const axisGizmoID = "axis gizmo";

// Helper function for providing the ability to update a scene and to also
// render it. Nothing in here touches the DOM; the app owns the canvas size and
// input events and drives the scene through the functions returned here.
function createSceneUpdater(gl, sceneManager) {
  const getFrameRate = createFrameRateCounter();

  const getCamera = () => sceneManager.getNodeByID(worldViewportID).activeCamera;

  // A camera behavior decides how the world viewport's active camera responds
  // to the player's input. The app sends input to it through four calls, so
  // switching how the camera moves (from free-fly to third person, say) means
  // swapping this behavior and nothing else:
  // - turn(rightDegrees, upDegrees): turn in response to looking around, such
  //   as moving the mouse.
  // - move(forward, right, up): move once by the given distances in scene
  //   units, such as for scrolling.
  // - setMovement({forward, right, up}): keep moving while input is held down,
  //   such as keys. Each value is -1, 0 or 1.
  // - update(seconds): called every frame with the seconds since the last one,
  //   to apply the movement that is held down.
  const cameraBehavior = createFreeFlyBehavior(sceneManager, getCamera);

  let lastFrameMs = null;

  // This is the logic for updating the scene state and the scene graph with the
  // new scene state. This is the logic for the game itself.
  function updateScene(ms) {
    // Seconds since the last frame, capped so that the camera does not jump
    // after the page has been in the background and frames were paused.
    const seconds = lastFrameMs === null ? 0 : Math.min((ms - lastFrameMs) / 1000, 0.1);
    lastFrameMs = ms;

    cameraBehavior.update(seconds);

    // The axis gizmo shows the world's axes as the camera sees them, so it is
    // rotated by the inverse of the camera's rotation. The inverse of a
    // rotation matrix is its transpose.
    const [pitch, yaw] = sceneManager.getNodeStateByID(getCamera().id).transform.rotation;
    const cameraRotation = mat4.rotate(mat4.identity(), pitch, yaw, 0);
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
    sceneManager.render(ms, gl);

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
    turnCamera: cameraBehavior.turn,
    moveCamera: cameraBehavior.move,
    setCameraMovement: cameraBehavior.setMovement,
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
  } = createSceneUpdater(gl, sceneManager);

  // This starts the render loop to render the scene!
  const stopRenderLoop = startRenderLoop(gl, updateScene, renderFrame);

  // dispose tears down everything this call set up, including the GPU
  // resources of every node in the scene, so that another scene can be
  // rendered in its place.
  function dispose() {
    stopRenderLoop();
    resourceLoader.dispose();
    sceneManager.dispose(gl);
  }

  try {
    // First thing is to load the shaders so that loading renderable
    // resources have them when they are getting built.
    await loadShaders(sceneConfig.preload.shaders);
    await resourceLoader.loadMany(getResourcesFromConfig(sceneConfig));
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
    dispose,
  };
};
