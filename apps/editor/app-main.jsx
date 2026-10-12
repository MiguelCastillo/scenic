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
  // rendering is not stretched, then let the scene rebuild its projections.
  // clientWidth and clientHeight are the canvas' displayed size.
  function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (currentScene) {
      currentScene.refreshProjection();
    }
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
        const {registerRefreshRateUpdater, resourceLoader, sceneManager, refreshProjection} = scene;

        sceneGraphRoot.render(
          <SceneGraph
            sceneManager={sceneManager}
            resourceLoader={resourceLoader}
            refreshProjection={refreshProjection}
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

// subscribeToSceneInput turns mouse and trackpad input on the mousetrap into
// movement of the current scene. Clicking the mousetrap locks the pointer to
// it, and input only moves the scene while the pointer is locked.
function subscribeToSceneInput(mousetrapEl, getCurrentScene) {
  let enableWorldTranslation = false;

  domEvents.Subscription.create(mousetrapEl)
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
      const scene = getCurrentScene();
      if (scene && document.pointerLockElement === mousetrapEl) {
        const devicePixelRatio = window.devicePixelRatio;
        const translationRatio = devicePixelRatio * 6;
        const rotationRatio = devicePixelRatio * 2;

        if (enableWorldTranslation || evt.shiftKey) {
          scene.easeWorldTranslation(
            evt.movementX / translationRatio,
            -evt.movementY / translationRatio,
            0
          );
        } else if (evt.ctrlKey) {
          scene.easeWorldTranslation(0, 0, evt.movementY / translationRatio);
        } else {
          scene.easeWorldRotation(evt.movementY / rotationRatio, evt.movementX / rotationRatio);
        }
      }
    })
    .on("wheel", (evt) => {
      // Prevent leaving the page when scrolling left/right with a trackpad
      evt.preventDefault();

      const scene = getCurrentScene();
      if (scene && document.pointerLockElement === mousetrapEl) {
        const devicePixelRatio = window.devicePixelRatio;
        const rotationRatio = devicePixelRatio * 6;

        if (evt.shiftKey) {
          scene.translateWorld(-(evt.deltaX / rotationRatio), evt.deltaY / rotationRatio, 0);
        } else if (evt.ctrlKey) {
          scene.translateWorld(0, 0, -(evt.deltaY / rotationRatio));
        } else {
          scene.rotateWorld(-evt.deltaY / devicePixelRatio, -evt.deltaX / devicePixelRatio);
        }
      }
    });
}
