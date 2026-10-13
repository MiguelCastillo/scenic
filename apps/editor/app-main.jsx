import React from "react";
import {createRoot} from "react-dom/client";
import {ready as domReady, events as domEvents} from "@scenic/dom";
import {webgl} from "@scenic/renderer";

import {SceneGraph} from "./app/app.jsx";
import {Error} from "./app/error.jsx";
import {Console} from "./app/console.jsx";
import {Loading} from "./app/loading.jsx";
import {SceneSelector} from "./app/scene-selector.jsx";
import {createSplitPanel} from "./split-panel.js";

import _console from "./logging.js";

// The dev server serves static files and cannot list a directory, so the
// scenes available to pick from are listed here. Keep in sync with scenes/.
const sceneFiles = [
  "scenes/armatured-cube-simple.json",
  "scenes/armatured-cube.json",
  "scenes/bump-lighting-sphere.json",
  "scenes/jedi-star-fighter.json",
  "scenes/skinning-mesh-animation-dancing-character.json",
];

domReady.onReady(() => {
  const canvas = document.querySelector("#glCanvas");
  const gl = webgl.createContext(canvas);

  // eslint-disable-next-line no-console
  console.log("Browser:", window.clientInformation.userAgent);
  const errorRoot = createRoot(document.querySelector("#error-container"));
  const loadingRoot = createRoot(document.querySelector("#loading-container"));
  const sceneSelectorRoot = createRoot(document.querySelector("#scene-selector-container"));
  const sceneGraphRoot = createRoot(document.querySelector("#scene-graph-container"));
  const fpsEl = document.querySelector("#fps");

  // The scene currently rendering, as returned by renderScene. It is disposed
  // before another scene is rendered in its place.
  let currentScene = null;

  // The page layout and input listeners are shared by every scene, so they are
  // set up once here and forward to whichever scene is current.
  const splitPanelEl = document.getElementById("app-panel");
  createSplitPanel(splitPanelEl);

  // Keep the canvas drawing buffer the same size as the canvas is displayed so
  // rendering is not stretched. clientWidth and clientHeight are the canvas'
  // displayed size. Cameras rebuild their projections from the drawing buffer
  // size every frame, so they pick up the new size on their own.
  function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  resizeCanvas();
  domEvents.Subscription.create(window).on("resize", resizeCanvas);
  domEvents.Subscription.create(splitPanelEl).on("panel:resize", resizeCanvas);

  subscribeToSceneInput(document.getElementById("mousetrap"), () => currentScene);

  // Cancel is only offered when there is a scene to go back to.
  function showSceneSelector() {
    sceneSelectorRoot.render(
      <SceneSelector
        sceneFiles={sceneFiles}
        onSelect={loadScene}
        onCancel={currentScene ? hideSceneSelector : null}
      />
    );
  }

  function hideSceneSelector() {
    sceneSelectorRoot.render(null);
  }

  function loadScene(sceneFile) {
    hideSceneSelector();

    if (currentScene) {
      currentScene.dispose();
      currentScene = null;
    }

    // Rendering null unmounts the previous SceneGraph so that its state, such
    // as the selected node, does not carry over to the new scene.
    sceneGraphRoot.render(null);
    fpsEl.innerHTML = "";
    loadingRoot.render(<Loading isLoading={true} />);

    fetch(sceneFile)
      .then((response) => response.json())
      // window.scene is exported from scene-main.js via the UMD export.
      // See .pakit-scene.js for more details.
      .then((config) => window.scene.renderScene(gl, config))
      .then((scene) => {
        currentScene = scene;
        const {registerRefreshRateUpdater, resourceLoader, sceneManager} = scene;

        sceneGraphRoot.render(
          <SceneGraph
            sceneManager={sceneManager}
            resourceLoader={resourceLoader}
            onChangeScene={showSceneSelector}
          />
        );

        registerRefreshRateUpdater((fps) => {
          fpsEl.innerHTML = fps;
        });

        loadingRoot.render(<Loading isLoading={false} />);
      })
      .catch((ex) => {
        loadingRoot.render(<Loading isLoading={false} />);
        errorRoot.render(
          <>
            <Error error={ex} />
            <Console buffer={_console.buffer} />
          </>
        );
      });
  }

  showSceneSelector();
});

// How far the camera turns, in degrees, per pixel of mouse movement, and how
// far it flies, in scene units, per pixel of wheel or trackpad scrolling.
const cameraTurnDegreesPerPixel = 0.1;
const cameraScrollDistancePerPixel = 0.5;

// Keys that fly the camera while they are held, by KeyboardEvent.code so that
// they stay in the same place on every keyboard layout.
const cameraMovementKeys = {
  KeyW: {forward: 1},
  KeyS: {forward: -1},
  KeyD: {right: 1},
  KeyA: {right: -1},
  KeyE: {up: 1},
  KeyQ: {up: -1},
};

// subscribeToSceneInput maps the mouse and keyboard onto the current scene's
// camera controls. How the camera responds is up to its camera behavior (see
// camera-behaviors/ and where scene-main.js creates it). Clicking the
// mousetrap locks the pointer to it, and input only moves the camera while
// the pointer is locked, so typing in the editor's panels is left alone.
// Pressing Escape releases the lock.
function subscribeToSceneInput(mousetrapEl, getCurrentScene) {
  const isPointerLocked = () => document.pointerLockElement === mousetrapEl;
  const heldKeys = new Set();

  function updateCameraMovement() {
    const scene = getCurrentScene();
    if (!scene) {
      return;
    }

    const movement = {forward: 0, right: 0, up: 0};
    for (const code of heldKeys) {
      for (const [direction, amount] of Object.entries(cameraMovementKeys[code])) {
        movement[direction] += amount;
      }
    }
    scene.setCameraMovement(movement);
  }

  domEvents.Subscription.create(mousetrapEl)
    .on("click", (/*evt*/) => {
      mousetrapEl.requestPointerLock();
    })
    .on("mousemove", (evt) => {
      const scene = getCurrentScene();
      if (scene && isPointerLocked()) {
        scene.turnCamera(
          evt.movementX * cameraTurnDegreesPerPixel,
          -evt.movementY * cameraTurnDegreesPerPixel
        );
      }
    })
    .on("wheel", (evt) => {
      // Prevent leaving the page when scrolling left/right with a trackpad
      evt.preventDefault();

      const scene = getCurrentScene();
      if (scene && isPointerLocked()) {
        scene.moveCamera(
          -evt.deltaY * cameraScrollDistancePerPixel,
          evt.deltaX * cameraScrollDistancePerPixel,
          0
        );
      }
    });

  domEvents.Subscription.create(document)
    .on("keydown", (evt) => {
      if (!isPointerLocked()) {
        return;
      }

      if (!cameraMovementKeys[evt.code]) {
        return;
      }

      evt.preventDefault();
      heldKeys.add(evt.code);
      updateCameraMovement();
    })
    .on("keyup", (evt) => {
      if (!cameraMovementKeys[evt.code]) {
        return;
      }

      heldKeys.delete(evt.code);
      updateCameraMovement();
    })
    // Keys released while the pointer was unlocked never send keyup here, so
    // everything is treated as released when the lock is lost.
    .on("pointerlockchange", () => {
      if (!isPointerLocked()) {
        heldKeys.clear();
        updateCameraMovement();
      }
    });
}
