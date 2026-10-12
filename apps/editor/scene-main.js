//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

// This will inject buffering into `console` so that we can access it later.
import "./logging.js";

import {projections, vec3, easings} from "@scenic/math";
import {webgl} from "@scenic/renderer";

import {createScene, buildDefaultState} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {loadShaders} from "./shader-factory.js";
import {startRenderLoop} from "./render-loop.js";

import {createFrameRateCounter} from "./fps-counter.js";

const sceneObjectsID = "scene objects";
const axisProjectionID = "axis projection";
const worldProjectionID = "world projection";

function applyWorldRotation(sceneManager, rotateX, rotateY, rotateZ = 0) {
  const sceneObjects = sceneManager.getNodeStateByID(sceneObjectsID);

  sceneManager.updateNodeStateByID(sceneObjectsID, {
    transform: {
      ...sceneObjects.transform,
      rotation: vec3.add([rotateX, rotateY, rotateZ], sceneObjects.transform.rotation),
    },
  });
}

function applyWorldTranslation(sceneManager, translateX, translateY, translateZ) {
  const sceneObjects = sceneManager.getNodeStateByID(sceneObjectsID);

  sceneManager.updateNodeStateByID(sceneObjectsID, {
    transform: {
      ...sceneObjects.transform,
      position: vec3.add([translateX, translateY, translateZ], sceneObjects.transform.position),
    },
  });
}

// Helper function for providing the ability to update a scene and to also
// render it. Nothing in here touches the DOM; the app owns the canvas size and
// input events and drives the scene through the functions returned here.
function createSceneUpdater(gl, sceneManager) {
  const getFrameRate = createFrameRateCounter();

  let axisProjectionMatrix, perspectiveProjectionMatrix;

  // Projections are sized from the canvas drawing buffer, which the app keeps
  // the same size as the canvas is displayed. Call this whenever that size or
  // the projection settings change.
  function refreshProjection() {
    const {width, height} = gl.canvas;

    const worldProjectionState = sceneManager.getNodeStateByID(worldProjectionID);
    perspectiveProjectionMatrix = createPerspectiveProjectionMatrix(
      width,
      height,
      worldProjectionState.projection.fov,
      worldProjectionState.projection.near,
      worldProjectionState.projection.far
    );

    const axisProjectionState = sceneManager.getNodeStateByID(axisProjectionID);
    axisProjectionMatrix = createOrthographicProjectionMatrix(
      width,
      height,
      axisProjectionState.projection.far
    );
  }

  refreshProjection();

  // rotateWorld and translateWorld move the scene objects right away. The
  // ease variants spread the movement over the next few frames instead.
  const rotateWorld = (rotateX, rotateY) => applyWorldRotation(sceneManager, rotateX, rotateY);
  const translateWorld = (translateX, translateY, translateZ) =>
    applyWorldTranslation(sceneManager, translateX, translateY, translateZ);

  const worldRotation = new easings.WeightedItems(easings.easeInQuart);
  const worldTranslation = new easings.WeightedItems(easings.easeInQuart);
  const easeWorldRotation = (rotateX, rotateY) => worldRotation.start([rotateX, rotateY]);
  const easeWorldTranslation = (translateX, translateY, translateZ) =>
    worldTranslation.start([translateX, translateY, translateZ]);

  // This is the logic for updating the scene state and the scene graph with the
  // new scene state. This is the logic for the game itself.
  function updateScene(/*ms*/) {
    sceneManager.getNodeByID(worldProjectionID).withProjection(perspectiveProjectionMatrix);

    const axisProjection = sceneManager
      .getNodeByID(axisProjectionID)
      .withProjection(axisProjectionMatrix);

    const sceneObjectsTransform = sceneManager.getNodeStateByID(sceneObjectsID).transform;

    const axisProjcetionState = sceneManager.getNodeStateByID(axisProjection.id);
    sceneManager.updateNodeStateByID(axisProjection.id, {
      transform: {
        ...axisProjcetionState.transform,
        rotation: sceneObjectsTransform.rotation,
      },
    });

    if (worldRotation.update()) {
      applyWorldRotation(sceneManager, ...worldRotation.getWeighted());
    }
    if (worldTranslation.update()) {
      applyWorldTranslation(sceneManager, ...worldTranslation.getWeighted());
    }
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
    refreshProjection,
    registerRefreshRateUpdater,
    rotateWorld,
    translateWorld,
    easeWorldRotation,
    easeWorldTranslation,
  };
}

// Projection matrix projects pixel space to clip space which has the range of
// -1 to 1 on every axis. Coordinates defined in client code is much simpler to
// reason about in pixel space, but when rasterizing it is much simpler for the
// low level engines to work with clip space, which is used for determining
// what geometry can be culled out.
function createPerspectiveProjectionMatrix(width, height, fov = 90, near = 0, far = 1000) {
  // Primitives are clipped to a space coordinate that ranges from -1 to 1
  // in all axis. This is what the hardware wants, so we need to project
  // screen space to clip space so that all things that we render can be
  // in screen space, but when we render to can convert all things to clip
  // space for the hardward to properly cull out and rasterize everything
  // we render.
  return projections.PerspectiveProjectionMatrix.create(fov, width, height, near, far);
}

function createOrthographicProjectionMatrix(width, height, far = 1000) {
  // Primitives are clipped to a space coordinate that ranges from -1 to 1
  // in all axis. This is what the hardware wants, so we need to project
  // screen space to clip space so that all things that we render can be
  // in screen space, but when we render to can convert all things to clip
  // space for the hardward to properly cull out and rasterize everything
  // we render.
  return projections.OrthographicProjectionMatrix.create(width, height, far);
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
    refreshProjection,
    registerRefreshRateUpdater,
    rotateWorld,
    translateWorld,
    easeWorldRotation,
    easeWorldTranslation,
  } = createSceneUpdater(gl, sceneManager);

  // This starts the render loop to render the scene!
  const stopRenderLoop = startRenderLoop(gl, updateScene, renderFrame);

  // dispose tears down everything this call set up so that another scene can
  // be rendered in its place. GPU resources (buffers, textures, programs) are
  // not released yet.
  function dispose() {
    stopRenderLoop();
    resourceLoader.dispose();
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
    refreshProjection,
    registerRefreshRateUpdater,
    rotateWorld,
    translateWorld,
    easeWorldRotation,
    easeWorldTranslation,
    dispose,
  };
};
