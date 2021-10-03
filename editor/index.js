//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

import {App} from "./app.js";
import webgl from "../src/webgl.js";
import {
  PerspectiveProjectionMatrix,
  OrthographicProjectionMatrix,
} from "../src/math/projections.js";
import * as vec3 from "../src/math/vector3.js";
import * as angles from "../src/math/angles.js";
import * as easings from "../src/math/easings.js";
import {Subscription} from "../src/dom/events.js";
import {keyframe} from "../src/animation/keyframe.js";
import {onReady} from "../src/dom/ready.js";

import {createSplitPanel} from "./split-panel.js";
import {createScene} from "./scene-factory.js";
import {createResourceLoader, getResourcesFromConfig} from "./loaders/resource-loader.js";
import {createShaderProgramLoader, getNodesWithShadersFromConfig} from "./shader-factory.js";
import {startRenderLoop} from "./render-loop.js";

import {createFrameRateCounter} from "./fps-counter.js";
import {config} from "./scene-config.js";

function applyWorldRotation(stateManager, rotateX, rotateY, rotateZ=0) {
  const worldMatrixName = "world projection";
  const worldMatrix = stateManager.getItemByName(worldMatrixName);

  stateManager.updateItemByName(worldMatrixName, {
    transform: {
      ...worldMatrix.transform,
      rotation: vec3.add(
        [rotateX, rotateY, rotateZ],
        worldMatrix.transform.rotation
      ),
    },
  });
}

function applyWorldTranslation(stateManager, translateX, translateY, translateZ) {
  const worldMatrixName = "world projection";
  const worldMatrix = stateManager.getItemByName(worldMatrixName);

  stateManager.updateItemByName(worldMatrixName, {
    transform: {
      ...worldMatrix.transform,
      position: vec3.add(
        [translateX, translateY, translateZ],
        worldMatrix.transform.position
      ),
    },
  });
}

// Helper function for providing the ability to update a scene and to also
// render it.
function createSceneUpdater(gl, sceneManager, stateManager) {
  const getFrameRate = createFrameRateCounter();

  let axisProjectionMatrix, perspectiveProjectionMatrix;

  function refreshProjection() {
    const {canvas} = gl;
    const {clientWidth, clientHeight} = canvas;

    const worldProjectionState = stateManager.getItemByName("world projection");
    perspectiveProjectionMatrix = createPerspectiveProjectionMatrix(
      clientWidth,
      clientHeight,
      worldProjectionState.projection.fov,
      worldProjectionState.projection.near,
      worldProjectionState.projection.far,
    );

    const axisProjectionState = stateManager.getItemByName("axis projection");
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
        const {devicePixelRatio} = window;

        if (enableWorldTranslation || evt.ctrlKey) {
          const translationRatio = devicePixelRatio*6;
          worldTranslation.start([
            evt.movementX/translationRatio,
            -evt.movementY/translationRatio,
            0,
          ]);
        }
        else {
          const rotationRatio = devicePixelRatio;
          worldRotation.start([
            evt.movementY/rotationRatio,
            evt.movementX/rotationRatio,
          ]);
        }
      }
    })
    .on("wheel", (evt) => {
      // Prevent leaving the page when scrolling left/right with a trackpad
      evt.preventDefault();

      if (document.pointerLockElement === mousetrapEl) {
        const {devicePixelRatio} = window;
        const rotationRatio = devicePixelRatio*6;
        applyWorldTranslation(stateManager, 0, 0, -(evt.deltaY/rotationRatio));
      }
    });

  const lightRotations = (() => {
    const frames = [];
    // for (let i = -3, idx = 0; i <= 3; i++, idx++) {
    //   frames[idx] = [i, 0, 0];
    // }

    for (let i = 0; i < 360; i++) {
      frames[i] = [
        -angles.cos(i),
        0,
        -angles.sin(i),
      ];
    }

    return keyframe(frames);
  })()

  // This is the logic for updating the scene state and the scene graph with the
  // new scene state. This is the logic for the game itself.
  function updateScene(ms) {
    const worldProjectionName = "world projection";
    sceneManager
      .getNodeByName(worldProjectionName)
      .withProjection(perspectiveProjectionMatrix);

    const axisName = "axis projection";
    sceneManager
      .getNodeByName(axisName)
      .withProjection(axisProjectionMatrix);

    const axisState = stateManager.getItemByName(axisName);
    stateManager.updateItemByName(axisName, {
      transform: {
        ...axisState.transform,
        rotation: stateManager.getItemByName(worldProjectionName).transform.rotation,
      },
    });

    // Update rotations based on keyboard inputs.
    const group1Name = "group-1";
    const group1State = stateManager.getItemByName(group1Name);
    stateManager.updateItemByName(group1Name, {
      transform: {
        ...group1State.transform,
        rotation: vec3.add([0, 1, 0], group1State.transform.rotation),
      },
    });

    const lightState = stateManager.getItemByName("light-yellow");
    const lightRotationMultiplier = 15;
    const lightPosition = lightRotations(ms, 20);
    lightPosition[0] *= lightRotationMultiplier;
    lightPosition[1] *= lightRotationMultiplier;
    lightPosition[2] *= lightRotationMultiplier;

    stateManager.updateItemByName("light-yellow", {
      transform: {
        ...lightState.transform,
        position: lightPosition,
      },
    });

    if (worldRotation.update()) {
      applyWorldRotation(stateManager, ...worldRotation.getWeighted());
    }
    if (worldTranslation.update()) {
      applyWorldTranslation(stateManager, ...worldTranslation.getWeighted());
    }
  }

  function renderScene(ms) {
    sceneManager.render(stateManager, (node) => {
      const projectionMatrix = sceneManager.getProjectionMatrixForNode(node);

      node.render({
        gl,
        projectionMatrix,
        sceneManager,
        stateManager,
      })
    });

    // Let's write out the number of frames per second that we are able to
    // render.
    const {frameRate, lapsedMs} = getFrameRate(ms);
    if (lapsedMs > 1000) {
      // eslint-disable-next-line
      //console.log(frameRate);
    }
  }

  return {
    updateScene,
    renderScene,
    refreshProjection,
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

// Whenever the DOM is ready is when we want to start doing work. That's
// because the canvas where we render stuff needs to be ready for creating the
// webgl context and be ready for rendering.
onReady(() => {
  const start = Date.now();
  const app = new App();

  try {
    // webgl context! There is where we render all the stuff. This is
    // the thing that renders to screen.
    const gl = webgl.createContext(document.querySelector("#glCanvas"));

    // Let's create the scene, which is made up of a scene manager and a
    // state manager.
    const {sceneManager, stateManager} = createScene(config);

    // API for loading resources for scene nodes.
    const resourceLoader = createResourceLoader(gl, sceneManager);
    const shaderProgramLoader = createShaderProgramLoader(gl, sceneManager);

    // Two functions to update the scene state and another for actually render
    // the scene based on the updated scene state.
    const {
      updateScene,
      renderScene,
      refreshProjection,
    } = createSceneUpdater(gl, sceneManager, stateManager);

    // Startup up the app. We give it the state manager so that it can create
    // the scene tree panel. This will render a spinner until we call
    // app.ready.  Or an error if something goes wrong when settings things up.
    app.init({resourceLoader, sceneManager, stateManager, refreshProjection});

    // This starts the render loop to render the scene!
    startRenderLoop(gl, updateScene, renderScene);

    Promise.all([
      resourceLoader.loadMany(getResourcesFromConfig(config)),
      shaderProgramLoader.loadMany(getNodesWithShadersFromConfig(config)),
    ]).then(() => {
      app.ready();

      // eslint-disable-next-line
      console.log(`Load time: ${(Date.now() - start)/1000} secs`)
    });
  }
  catch(ex) {
    // Report error
    app.error(ex);
    throw ex;
  }
});
