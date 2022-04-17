//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

// This will inject buffering into `console` so that we can access it later.
import "./logging.js";

import {
  PerspectiveProjectionMatrix,
  OrthographicProjectionMatrix,
} from "../src/math/projections.js";
import * as vec3 from "../src/math/vector3.js";
import * as easings from "../src/math/easings.js";
import {Subscription} from "../src/dom/events.js";

import {createSplitPanel} from "./split-panel.js";
import {createScene} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {loadShaders} from "./shader-factory.js";
import {startRenderLoop} from "./render-loop.js";

import {createFrameRateCounter} from "./fps-counter.js";
import {config} from "./scene-config.js";
import {getDebugData} from "../src/webgl.js";

function applyWorldRotation(sceneManager, rotateX, rotateY, rotateZ=0) {
  const sceneObjectsName = "scene objects";
  const sceneObjects = sceneManager.getNodeStateByName(sceneObjectsName);

  sceneManager.updateNodeStateByName(sceneObjectsName, {
    transform: {
      ...sceneObjects.transform,
      rotation: vec3.add(
        [rotateX, rotateY, rotateZ],
        sceneObjects.transform.rotation
      ),
    },
  });
}

function applyWorldTranslation(sceneManager, translateX, translateY, translateZ) {
  const sceneObjectsName = "scene objects";
  const sceneObjects = sceneManager.getNodeStateByName(sceneObjectsName);

  sceneManager.updateNodeStateByName(sceneObjectsName, {
    transform: {
      ...sceneObjects.transform,
      position: vec3.add(
        [translateX, translateY, translateZ],
        sceneObjects.transform.position
      ),
    },
  });
}

// Helper function for providing the ability to update a scene and to also
// render it.
function createSceneUpdater(gl, sceneManager) {
  const getFrameRate = createFrameRateCounter();

  let axisProjectionMatrix, perspectiveProjectionMatrix;

  function refreshProjection() {
    const {canvas} = gl;
    const {clientWidth, clientHeight} = canvas;

    const worldProjectionState = sceneManager.getNodeStateByName("world projection");
    perspectiveProjectionMatrix = createPerspectiveProjectionMatrix(
      clientWidth,
      clientHeight,
      worldProjectionState.projection.fov,
      worldProjectionState.projection.near,
      worldProjectionState.projection.far,
    );

    const axisProjectionState = sceneManager.getNodeStateByName("axis projection");
    axisProjectionMatrix = createOrthographicProjectionMatrix(
      clientWidth,
      clientHeight,
      axisProjectionState.projection.far,
    );
  }

  function handleResize() {
    const {canvas} = gl;
    const {clientWidth, clientHeight} = canvas;
    canvas.width = clientWidth;
    canvas.height = clientHeight;
    refreshProjection();
  }

  // Initialize projections and canvas dimensions.
  handleResize();

  // Update canvas width/height whenever the window is resized. clientHeight
  // and clientWidth are the window.innerHeight and window.innerWidth. it is
  // just a convenient accessor for the global object dimensions.
  Subscription.create(window)
    .on("resize", () => {
      handleResize();
    });

  const splitPanelEl = document.getElementById("app-panel");
  createSplitPanel(splitPanelEl);

  Subscription.create(splitPanelEl)
    .on("panel:resize", () => {
      handleResize();
    });

  let enableWorldTranslation = false;
  const worldRotation = new easings.WeightedItems(easings.easeInQuart);
  const worldTranslation = new easings.WeightedItems(easings.easeInQuart);
  const mousetrapEl = document.getElementById("mousetrap");
  Subscription.create(mousetrapEl)
    .on("click", (/*evt*/) => {
      mousetrapEl.requestPointerLock();
    })
    .on("mousedown", (/*evt*/) => {
      enableWorldTranslation = true;
    })
    .on("mouseup", (/*evt*/) => {
      enableWorldTranslation = false;
    })
    .on("mousemove", (evt) => {
      if (document.pointerLockElement === mousetrapEl) {
        const devicePixelRatio = window.devicePixelRatio;
        const translationRatio = devicePixelRatio*6;
        const rotationRatio = devicePixelRatio*2;

        if (enableWorldTranslation || evt.shiftKey) {
          worldTranslation.start([evt.movementX/translationRatio, -evt.movementY/translationRatio, 0]);
        } else if (evt.ctrlKey) {
          worldTranslation.start([0, 0, evt.movementY/translationRatio]);
        } else {
          worldRotation.start([evt.movementY/rotationRatio, evt.movementX/rotationRatio]);
        }
      }
    })
    .on("wheel", (evt) => {
      // Prevent leaving the page when scrolling left/right with a trackpad
      evt.preventDefault();

      if (document.pointerLockElement === mousetrapEl) {
        const devicePixelRatio = window.devicePixelRatio;
        const rotationRatio = devicePixelRatio*6;

        if (evt.shiftKey) {
          applyWorldTranslation(sceneManager, -(evt.deltaX/rotationRatio), (evt.deltaY/rotationRatio), 0);
        } else if (evt.ctrlKey) {
          applyWorldTranslation(sceneManager, 0, 0, -(evt.deltaY/rotationRatio));
        } else {
          applyWorldRotation(sceneManager, -evt.deltaY/devicePixelRatio, -evt.deltaX/devicePixelRatio);
        }
      }
    });

  // This is the logic for updating the scene state and the scene graph with the
  // new scene state. This is the logic for the game itself.
  function updateScene(/*ms*/) {
    const worldProjectionName = "world projection";
    sceneManager
      .getNodeByName(worldProjectionName)
      .withProjection(perspectiveProjectionMatrix);

    const axisName = "axis projection";
    sceneManager
      .getNodeByName(axisName)
      .withProjection(axisProjectionMatrix);

    const sceneObjectsName = "scene objects";
    const axisState = sceneManager.getNodeStateByName(axisName);
    sceneManager.updateNodeStateByName(axisName, {
      transform: {
        ...axisState.transform,
        rotation: sceneManager.getNodeStateByName(sceneObjectsName).transform.rotation,
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
  const registerRefreshRateUpdater = (cb) => {refreshRateUpdater = cb};

  function renderScene(ms) {
    sceneManager.render(ms, gl);

    // Let's write out the number of frames per second that we are able to
    // render.
    const {frameRate, lapsedMs} = getFrameRate(ms);
    if (lapsedMs > 1000 && lastFps !== frameRate) {
      lastFps = frameRate;
      refreshRateUpdater(frameRate);
    }
  }

  return {
    updateScene,
    renderScene,
    refreshProjection,
    registerRefreshRateUpdater,
  };
}

// Projection matrix projects pixel space to clip space which has the range of
// -1 to 1 on every axis. Coordinates defined in client code is much simpler to
// reason about in pixel space, but when rasterizing it is much simpler for the
// low level engines to work with clip space, which is used for determining
// what geometry can be culled out.
function createPerspectiveProjectionMatrix(width, height, fov=90, near=0, far=1000) {
  // Primitives are clipped to a space coordinate that ranges from -1 to 1
  // in all axis. This is what the hardware wants, so we need to project
  // screen space to clip space so that all things that we render can be
  // in screen space, but when we render to can convert all things to clip
  // space for the hardward to properly cull out and rasterize everything
  // we render.
  return PerspectiveProjectionMatrix.create(fov, width, height, near, far);
}

function createOrthographicProjectionMatrix(width, height, far=1000) {
  // Primitives are clipped to a space coordinate that ranges from -1 to 1
  // in all axis. This is what the hardware wants, so we need to project
  // screen space to clip space so that all things that we render can be
  // in screen space, but when we render to can convert all things to clip
  // space for the hardward to properly cull out and rasterize everything
  // we render.
  return OrthographicProjectionMatrix.create(width, height, far);
}

export let sceneManager;

export const doRenderLoop = (gl) => {
  const {
    vendor, renderer, limits, contextAttributes,
  } = getDebugData(gl);

  // eslint-disable-next-line no-console
  console.log("Vendor:", vendor);
  // eslint-disable-next-line no-console
  console.log("Renderer:", renderer);
  // eslint-disable-next-line no-console
  console.log("Limits:", JSON.stringify(limits));
  // eslint-disable-next-line no-console
  console.log("Context:", JSON.stringify(contextAttributes));
  // eslint-disable-next-line no-console
  console.log("Browser:", window.clientInformation.userAgent);

  const start = Date.now();

  // Let's create the scene, which is made up of a scene manager and a
  // state manager.
  sceneManager = createScene(config);

  // API for loading resources for scene nodes.
  const resourceLoader = createResourceLoader(gl, sceneManager);

  // Two functions to update the scene state and another for actually render
  // the scene based on the updated scene state.
  const {
    updateScene,
    renderScene,
    refreshProjection,
    registerRefreshRateUpdater,
  } = createSceneUpdater(gl, sceneManager);

  // This starts the render loop to render the scene!
  startRenderLoop(gl, updateScene, renderScene);

  // First thing is to load the shaders so that loading renderable
  // resources have them when they are getting built.
  return loadShaders(config.preload.shaders)
    .then(() => resourceLoader.loadMany(getResourcesFromConfig(config)))
    .then(() => {
      // eslint-disable-next-line
      console.log(`Load time: ${(Date.now() - start)/1000} secs`)

      return {resourceLoader, sceneManager, refreshProjection, registerRefreshRateUpdater};
    });
};
