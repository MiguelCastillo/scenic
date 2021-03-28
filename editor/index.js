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
import {ShaderProgram} from "../src/shaders/program.js";

import {
  VertexBuffer,
  VertexBufferData,
} from "../src/renderer/vertexbuffer.js";

import {Node as SceneNode} from "../src/scene/node.js";
import {Light as SceneLight} from "../src/scene/light.js";
import {StaticMesh} from "../src/scene/static-mesh.js";
import {SceneManager, treeTraversal} from "../src/scene-manager.js";
import {StateManager} from "../src/state-manager.js";
import {ResourceManager} from "../src/resource-manager.js";
import {ObjLoader} from "./file-loaders.js";

import {createFrameRateCounter} from "./fps-counter.js";
import {config} from "./scene-config.js";


function buildScene(gl, stateManager) {
  const sceneManager = new SceneManager();

  const renderableShaderProgram = createRenderableShaderProgram(gl, new Array(8).fill(0))
    .addAttributes([
      {
        name: "color",
      }, {
        name: "normal",
      }, {
        name: "position",
      },
    ]);

  const lightSourceProgramShader = createPointShaderProgram(gl)
    .addAttributes([
      {
        name: "color",
      }, {
        name: "position",
      },
    ]);

  function buildSceneParentNode(parent, items) {
    return parent.addItems(items);
  }

  function buildSceneNode(node /*, parent*/) {
    if (node.type === "static-mesh") {
      return new StaticMesh(node).withShaderProgram(renderableShaderProgram);
    }
    else if (node.type === "light") {
      return new SceneLight(node).withShaderProgram(lightSourceProgramShader);
    }

    return new SceneNode(node);
  }

  const traverse = treeTraversal(buildSceneNode, buildSceneParentNode);
  const sceneNodes = stateManager.getItems().map(item => traverse(item));

  // Two functions to update the scene state and another for actually render
  // the scene based on the updated scene state.
  const {updateScene, renderScene} = createSceneUpdater(
    gl, sceneManager.withSceneNodes(sceneNodes), stateManager);

  return {
    updateScene,
    renderScene,
    sceneManager,
    stateManager,
  };
}

function createSplitPanel(el) {
  let resizeEnabled = false;
  const resizerEl = el.querySelector(".resizer");

  if (!resizerEl) {
    throw new Error("Unable to find resizer element");
  }

  Subscription.create(resizerEl)
    .on("mousedown", () => {
      resizeEnabled = true;
    });

  Subscription.create(el)
    .on("mouseup", () => {
      resizeEnabled = false;
    })
    .on("mousemove", (evt) => {
      if (resizeEnabled) {
        el.style.setProperty("--resizer-position", evt.clientX + "px");
        el.dispatchEvent(new Event("panel:resize"));
      }
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
        applyWorldTranslation(0, 0, -(evt.deltaY/rotationRatio));
      }
    });

  function applyWorldRotation(rotateX, rotateY, rotateZ=0) {
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

  function applyWorldTranslation(translateX, translateY, translateZ) {
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
      applyWorldRotation(...worldRotation.getWeighted());
    }
    if (worldTranslation.update()) {
      applyWorldTranslation(...worldTranslation.getWeighted());
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

function createRenderableShaderProgram(gl, lights) {
  const vertShaderCode = `#version 300 es
    in vec4 position;
    in vec4 normal;
    in vec4 color;

    uniform mat4 projectionMatrix;
    uniform mat4 worldMatrix;

    out vec4 fragmentColor;
    out vec4 fragmentNormal;

    void main() {
      mat4 transform = projectionMatrix * worldMatrix;
      gl_Position = transform * position;

      fragmentNormal = worldMatrix * vec4(normal.xyz, 0.0);
      fragmentColor = color;
    }
  `;

  const fragShaderCode = `#version 300 es
    precision highp float;
    out vec4 pixelColor;

    in vec4 fragmentColor;
    in vec4 fragmentNormal;

    uniform vec3 ambientLightColor;
    uniform vec4 materialColor;
    uniform float materialReflectiveness;

    ${declareLights(lights)}

    vec3 calculateDiffuseLight(vec3 normal, vec3 lightPosition, vec3 lightColor, float lightIntensity) {
      if (lightIntensity == 0.0) {
        return vec3(0.0, 0.0, 0.0);
      }

      if (lightColor.r == 0.0 && lightColor.g == 0.0 && lightColor.b == 0.0) {
        return vec3(0.0, 0.0, 0.0);
      }

      return lightColor * lightIntensity * clamp(dot(normal, lightPosition), 0.1, 1.0);
    }

    void main() {
      vec3 calculatedLightColor = ambientLightColor;
      vec3 normal = normalize(fragmentNormal.xyz);

      if (materialReflectiveness != 0.0) {
        calculatedLightColor += ((${processDiffuseLighting(lights)}) * materialReflectiveness);
        // This gives a great blend of CYM colors to generate RGB colors.
        // calculatedLightColor += log2((${processDiffuseLighting(lights)}) * materialReflectiveness);
      }

      pixelColor = fragmentColor + materialColor;
      pixelColor.rgb *= calculatedLightColor.rgb;
    }
  `;

  function declareLights(lights) {
    return lights.map((_, idx) => (
      `uniform vec3 lightColor${idx};uniform vec3 lightPosition${idx};uniform float lightIntensity${idx};`
    )).join(" ");
  }

  function processDiffuseLighting(lights) {
    return lights
      .map((_, idx) => `calculateDiffuseLight(normal, lightPosition${idx}, lightColor${idx}, lightIntensity${idx})`)
      .join(" + ");
  }

  return new ShaderProgram(gl).link(vertShaderCode, fragShaderCode);
}

function createPointShaderProgram(gl) {
  const vertShaderCode = `#version 300 es
    in vec4 position;
    in vec4 color;

    out vec4 fragmentColor;

    uniform mat4 projectionMatrix;
    uniform mat4 worldMatrix;

    void main() {
      mat4 transform = projectionMatrix * worldMatrix;
      gl_Position = transform * position;
      fragmentColor = color;
    }
  `;

  const fragShaderCode = `#version 300 es
    precision highp float;
    out vec4 pixelColor;
    in vec4 fragmentColor;

    uniform vec4 materialColor;

    void main() {
      pixelColor = fragmentColor + materialColor;
    }
  `;

  return new ShaderProgram(gl).link(vertShaderCode, fragShaderCode);
}

// createKeyManager keeps track of the keyboard events and returns the list of
// currently pressed keys. This allows us to process multiple key down events
// simultaneously in the eventLoop.
function createKeyManager() {
  const keys = {};

  Subscription.create(window)
    .on("keyup", (evt) => {
      delete keys[evt.code];
    })
    .on("keydown", (evt) => {
      keys[evt.code] = true;
    });

  function getKeyState() {
    return keys;
  }

  return {
    getKeyState
  };
}

function createRotationManager() {
  return function updateRotation(keys) {
    const rotation = [0, 0, 0];

    Object.keys(keys).forEach(code => {
      if (code === "ArrowUp") {
        rotation[0] -= 1;
      } else if (code === "ArrowDown") {
        rotation[0] += 1;
      } else if (code === "ArrowRight") {
        if (keys["AltLeft"]) {
          rotation[2] -= 1;
        }
        else {
          rotation[1] += 1;
        }
      } else if (code === "ArrowLeft") {
        if (keys["AltLeft"]) {
          rotation[2] += 1;
        }
        else {
          rotation[1] -= 1;
        }
      }  
    });

    return rotation;
  }
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

function buildVertexBuffer(gl, model) {
  let {vertices, normals, colors} = model;

  const vertexBuffer = VertexBuffer.create({
    positions: new VertexBufferData(gl, vertices),
  });

  if (!normals.byteLength && !normals.length) {
    vertexBuffer.withNormals(
      new VertexBufferData(
        gl, vec3.normalizeTriangleVertices(new Float32Array(vertices))));
  }
  else {
    vertexBuffer.withNormals(new VertexBufferData(gl, normals));
  }

  if (colors.byteLength || colors.length) {
    vertexBuffer.withColors(new VertexBufferData(gl, colors));
  }

  return vertexBuffer;
}

function loadSceneResources(gl, resourceManager, {sceneManager, stateManager}) {
  // Load up all the resources.
  const resources = {}
  const traverse = treeTraversal((node) => {
    switch(node.type) {
      case "static-mesh":
      case "light":
        if (node.resource) {
          if (!resources[node.resource]) {
            resources[node.resource] = [];
          }

          resources[node.resource].push(node);
        }
        break;
    }

    return node;
  }, () => {});

  stateManager.getItems().map(item => traverse(item));

  const deferred = Object.keys(resources).map(resource => {
    return resourceManager.load(resource).then(model => {
      resources[resource].forEach(node => {
        sceneManager
          .getNodeByName(node.name)
          .withVertexBuffer(buildVertexBuffer(gl, model))
      });
    });
  });

  return Promise.all(deferred);
}

// Whenever the DOM is ready is when we want to start doing work. That's
// because the canvas where we render stuff needs to be ready for creating the
// webgl context and be ready for rendering.
onReady(() => {
  const start = Date.now();
  const app = new App();

  try {
    const stateManager = new StateManager(config.items);
    const objLoader = new ObjLoader();
    const resourceManager = new ResourceManager()
      .register("obj", (file) => objLoader.load(file));

    // Startup up the app.
    app.init({resourceManager, stateManager});

    const gl = webgl.createContext(document.querySelector("#glCanvas"));
    const scene = buildScene(gl, stateManager);
    startSceneLoop(gl, scene);

    loadSceneResources(gl, resourceManager, scene).then(() => {
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

function startSceneLoop(gl, {updateScene, renderScene}) {
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
