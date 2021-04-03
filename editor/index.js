//
// Reference:
// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
// https://www.tutorialspoint.com/webgl/webgl_drawing_points.htm
//

import {App} from "./app.js";
import webgl from "../src/webgl.js";
import {PerspectiveProjectionMatrix} from "../src/math/projections.js";
import * as vec3 from "../src/math/vector3.js";
import * as angles from "../src/math/angles.js";
import * as easings from "../src/math/easings.js";
import {Subscription} from "../src/dom/events.js";
import {onReady} from "../src/dom/ready.js";
import {treeGetMatches} from "../src/scene-manager.js";

import {createSplitPanel} from "./split-panel.js";
import {createScene} from "./scene-factory.js";
import {createResourceLoader} from "./resource-loader.js";

import {createFrameRateCounter} from "./fps-counter.js";
import {config} from "./scene-config.js";

function applyWorldRotation(stateManager, rotateX, rotateY, rotateZ=0) {
  const worldMatrixName = "world matrix";
  const worldMatrix = stateManager.getItemByName(worldMatrixName);

  stateManager.updateItemByName(worldMatrixName, {
    transform: {
      ...worldMatrix.transform,
      rotation: vec3.add([
        rotateX, rotateY, rotateZ],
        worldMatrix.transform.rotation),
    },
  });
}

function applyWorldTranslation(stateManager, translateX, translateY, translateZ) {
  const worldMatrixName = "world matrix";
  const worldMatrix = stateManager.getItemByName(worldMatrixName);

  stateManager.updateItemByName(worldMatrixName, {
    transform: {
      ...worldMatrix.transform,
      position: vec3.add([
        translateX, translateY, translateZ],
        worldMatrix.transform.position),
    },
  });
}

// Helper function for providing the ability to update a scene and to also
// render it.
function createSceneUpdater(gl, sceneManager, stateManager) {
  const getFrameRate = createFrameRateCounter();
  const {canvas} = gl;

  // The camera is the projection matrix.
  let projectionMatrix = createProjectionMatrix(canvas.clientWidth, canvas.clientHeight);
  let rotationDegrees = 0;

  function handleResize() {
    const {clientWidth, clientHeight} = canvas;
    canvas.width = clientWidth;
    canvas.height = clientHeight;
    projectionMatrix = createProjectionMatrix(clientWidth, clientHeight);
  }

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

  // This is the logic for updating the scene state and the scene graph with the
  // new scene state. This is the logic for the game itself.
  function updateScene(/*ms*/) {
    const group1Name = "group-1";

    // Update rotations based on keyboard inputs.
    const group1State = stateManager.getItemByName(group1Name);
    stateManager.updateItemByName(group1Name, {
      transform: {
        ...group1State.transform,
        rotation: vec3.add([0, 1, 0], group1State.transform.rotation),
      },
    });

    // We are going in a full circle (360 degrees) with this light.
    rotationDegrees = (rotationDegrees+1) % 360;
    const lightRotationAmount = Math.floor(rotationDegrees);
    const lightState = stateManager.getItemByName("light-yellow");
    const lightRotationMultiplier = 15;
    const lightPosition = [
      -angles.cos(lightRotationAmount) * lightRotationMultiplier,
      0,
      -angles.sin(lightRotationAmount) * lightRotationMultiplier,
    ];
    
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
    sceneManager.render(stateManager, (node) => node.render({
      gl,
      projectionMatrix,
      sceneManager,
      stateManager,
    }));

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
  };
}

// Projection matrix projects pixel space to clip space which has the range of
// -1 to 1 on every axis. Coordinates defined in client code is much simpler to
// reason about in pixel space, but when rasterizing it is much simpler for the
// low level engines to work with clip space, which is used for determining
// what geometry can be culled out.
function createProjectionMatrix(width, height, depth=1000) {
  // Primitives are clipped to a space coordinate that ranges from -1 to 1
  // in all axis. This is what the hardware wants, so we need to project
  // screen space to clip space so that all things that we render can be
  // in screen space, but when we render to can convert all things to clip
  // space for the hardward to properly cull out and rasterize everything
  // we render.
  return PerspectiveProjectionMatrix.create(90, width, height, 0, depth);
  // return OrthographicProjectionMatrix.create(width, height, depth);
}

function getResourcesFromConfig(config) {
  const traverse = treeGetMatches((node) => {
    return node.type === "static-mesh" || node.type === "light";
  });

  return (
    traverse(config.items)
    .map(item => {
      return {
        node: item,
        url: item.resource,
        filename: item.resource.split(/[\/]/).pop(),
      }
    }));
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
    const {
      sceneManager,
      stateManager,
    } = createScene(gl, config);

    // API for loading resources for scene nodes.
    const resourceLoader = createResourceLoader(gl, sceneManager);

    // Startup up the app. We give it the state manager so that it can create
    // the scene tree panel. This will render a spinner until we call
    // app.ready.  Or an error if something goes wrong when settings things up.
    app.init({resourceLoader, stateManager});

    // Two functions to update the scene state and another for actually render
    // the scene based on the updated scene state.
    const {
      updateScene,
      renderScene,
    } = createSceneUpdater(gl, sceneManager, stateManager);

    // This starts the render loop to render the scene!
    startRenderLoop(gl, updateScene, renderScene);

    resourceLoader.loadMany(getResourcesFromConfig(config)).then(() => {
      app.ready();

      // eslint-disable-next-line
      console.log(`Load time: ${(Date.now() - start)/1000} secs`)
    });
  }
  catch(ex) {
    // Report error
    app.error(ex);
  }
});

function startRenderLoop(gl, updateScene, renderScene) {
  const {canvas} = gl;

  // requestAnimationFrame will _try_ to run at 60 frames per seconds.
  requestAnimationFrame(function renderFrame(ms) {
    // Render all the things...
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    // gl.frontFace(gl.CW);
    
    // Update the scene and states.
    updateScene(ms);

    // Render the udpated scene with updated states.
    renderScene(ms);

    // Queue up next frame.
    requestAnimationFrame(renderFrame)
  });
}
