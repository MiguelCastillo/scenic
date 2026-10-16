import React from "react";
import {createRoot} from "react-dom/client";
import {ready as domReady, events as domEvents} from "@scenic/dom";
import {webgl} from "@scenic/renderer";
import {loadScene, renderStats, SceneRunner, startRenderLoop} from "@scenic/runtime";

import {SceneGraph} from "./app/app.jsx";
import {Error} from "./app/error.jsx";
import {Console} from "./app/console.jsx";
import {Loading} from "./app/loading.jsx";
import {SceneSelector} from "./app/scene-selector.jsx";
import {createSplitPanel} from "./split-panel.js";

import _console from "./logging.js";

// The dev server serves static files and cannot list a directory, so the
// scenes available to pick from are listed here: the editor's own, and the
// scenes of the games in games/. Keep in sync with both.
const sceneFiles = [
  "scenes/armatured-cube-simple.json",
  "scenes/armatured-cube.json",
  "scenes/bump-lighting-sphere.json",
  "scenes/jedi-star-fighter.json",
  "scenes/outdoors.json",
  "scenes/rockets.json",
  "scenes/skinning-mesh-animation-dancing-character.json",
  "scenes/trees.json",
  "/games/bubble-squadron/race.json",
  "/games/bubble-squadron/highway.json",
  "/games/bubble-squadron/menu.json",
  "/games/bubble-squadron/starfighters.json",
];

// clock is seconds as minutes, seconds and tenths, such as 1:05.3.
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;

// raceText is a race's message (see games/bubble-squadron/scripts/race.js)
// as the HUD shows it: the lap, time and next gate, and the best time.
function raceText({lap, laps, time, gate, gates, best, finished}) {
  const lines = finished
    ? [`Finished in ${clock(time)}`, "Fly through the start gate to race again"]
    : lap === 0
    ? ["Fly through the start gate to race"]
    : [
        `Lap ${lap}/${laps}   ${clock(time)}`,
        gate === 0
          ? lap === laps
            ? "Next: the finish"
            : "Next: the start gate"
          : `Next: gate ${gate} of ${gates}`,
      ];
  if (best != null) {
    lines.push(`Best ${clock(best)}`);
  }
  return lines.join("\n");
}

// thousands is n rounded to thousands, such as 18k.
const thousands = (n) => `${Math.round(n / 1000)}k`;

// What the HUD shows for each channel of the scene's sceneManager.ui (see
// UiBus in @scenic/scene), from its messages. Channels not here don't show.
// A terrain's (see Terrain in @scenic/runtime) also shows what the whole
// frame cost.
const hudTexts = {
  race: raceText,
  terrain: ({tiles, drawn, triangles, built}) =>
    `Terrain: ${tiles} tiles, ${drawn} drawn, ${thousands(triangles)} triangles, ${built} built\n` +
    `Frame: ${renderStats.last.drawCalls} draw calls, ${thousands(
      renderStats.last.triangles
    )} triangles`,
};

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
  const hudEl = document.querySelector("#hud");

  // The scene currently rendering: {scene, runner, stopRenderLoop}, the
  // scene loadScene loaded, its runner (see SceneRunner), which the input
  // drives, and what stops its render loop. It is stopped and disposed
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

  // The paused sign shows over the scene while it is paused.
  const pausedEl = document.querySelector("#paused");
  const showPaused = (paused) => {
    pausedEl.hidden = !paused;
  };

  subscribeToSceneInput(
    document.getElementById("mousetrap"),
    () => currentScene?.runner,
    renderSceneGraph,
    showPaused
  );

  // renderSceneGraph renders the scene graph panel for the current scene. It
  // is rendered again when the active camera changes, so that the panels show
  // it. Rendering the same SceneGraph again keeps its state,
  // such as the selected node.
  function renderSceneGraph() {
    const {resourceLoader, sceneManager} = currentScene.scene;
    const {cameras} = currentScene.runner;
    sceneGraphRoot.render(
      <SceneGraph
        sceneManager={sceneManager}
        resourceLoader={resourceLoader}
        cameras={cameras}
        onChangeScene={showSceneSelector}
      />
    );
  }

  // Cancel is only offered when there is a scene to go back to.
  function showSceneSelector() {
    sceneSelectorRoot.render(
      <SceneSelector
        sceneFiles={sceneFiles}
        onSelect={openScene}
        onCancel={currentScene ? hideSceneSelector : null}
      />
    );
  }

  function hideSceneSelector() {
    sceneSelectorRoot.render(null);
  }

  function openScene(sceneFile) {
    hideSceneSelector();

    if (currentScene) {
      currentScene.stopRenderLoop();
      currentScene.scene.dispose();
      currentScene = null;
    }

    // Rendering null unmounts the previous SceneGraph so that its state, such
    // as the selected node, does not carry over to the new scene.
    sceneGraphRoot.render(null);
    fpsEl.innerHTML = "";
    hudEl.textContent = "";
    showPaused(false);
    loadingRoot.render(<Loading isLoading={true} />);

    fetch(sceneFile)
      .then((response) => response.json())
      .then((config) => loadScene(gl, config, {sceneURL: sceneFile}))
      .then((scene) => {
        // Scenes run paused, until P is pressed.
        const runner = new SceneRunner(gl, scene);
        currentScene = {scene, runner, stopRenderLoop: startRenderLoop(gl, runner)};
        showPaused(runner.isPaused());

        renderSceneGraph();

        runner.registerRefreshRateUpdater((fps) => {
          fpsEl.innerHTML = fps;
        });

        // The HUD shows what the scene publishes on the channels it knows,
        // such as a race's lap and time, a blank line apart, in the order
        // they first came.
        const hud = new Map();
        scene.sceneManager.ui.onUpdate((channel, message) => {
          const text = hudTexts[channel]?.(message);
          if (text === undefined || hud.get(channel) === text) {
            return;
          }
          hud.set(channel, text);
          hudEl.textContent = [...hud.values()].filter(Boolean).join("\n\n");
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

// The key that switches to the next camera, such as from following a rocket
// to its cockpit.
const nextCameraKey = "KeyC";

// The key that pauses and resumes the scene.
const pauseKey = "KeyP";

// Keys that scroll the page, which scenes use instead while they have the
// pointer, such as to fly a rocket.
const pageScrollKeys = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// subscribeToSceneInput maps the mouse and keyboard onto the current scene's
// cameras. How the active camera responds is up to its type (see CameraSystem
// in the @scenic/camera package). Every key
// held down is also given to the scene's scripts, such as a rocket's flight
// controls, and so is how far the mouse moves. Clicking the mousetrap locks the
// pointer to it, and input only reaches the scene while the pointer is locked,
// so typing in the editor's panels is left alone. Pressing Escape releases the
// lock. Pressing P pauses the scene, and onPauseChange is told whether it is
// now paused. onCameraChange is called when the active camera changes.
function subscribeToSceneInput(mousetrapEl, getCurrentScene, onCameraChange, onPauseChange) {
  const isPointerLocked = () => document.pointerLockElement === mousetrapEl;
  const heldKeys = new Set();
  const scriptKeys = new Set();

  function updateScriptKeys() {
    getCurrentScene()?.setHeldKeys(scriptKeys);
  }

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
    scene.cameras?.setMovement(movement);
  }

  domEvents.Subscription.create(mousetrapEl)
    .on("click", (/*evt*/) => {
      mousetrapEl.requestPointerLock();
    })
    .on("mousemove", (evt) => {
      const scene = getCurrentScene();
      if (scene && isPointerLocked()) {
        // While paused the mouse looks around, even with cameras that leave
        // it to the scene.
        const right = evt.movementX * cameraTurnDegreesPerPixel;
        const up = -evt.movementY * cameraTurnDegreesPerPixel;
        if (scene.isPaused()) {
          scene.cameras?.lookAround(right, up);
        } else {
          scene.cameras?.turn(right, up);
        }
        scene.addMouseMovement(evt.movementX, evt.movementY);
      }
    })
    .on("wheel", (evt) => {
      // Prevent leaving the page when scrolling left/right with a trackpad
      evt.preventDefault();

      const scene = getCurrentScene();
      if (scene && isPointerLocked()) {
        scene.cameras?.move(
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

      if (!scriptKeys.has(evt.code)) {
        scriptKeys.add(evt.code);
        updateScriptKeys();
      }
      if (pageScrollKeys.has(evt.code)) {
        evt.preventDefault();
      }

      if (evt.code === pauseKey && !evt.repeat) {
        evt.preventDefault();
        const scene = getCurrentScene();
        if (scene) {
          onPauseChange(scene.togglePause());
        }
        return;
      }

      if (evt.code === nextCameraKey && !evt.repeat) {
        evt.preventDefault();
        const scene = getCurrentScene();
        if (scene) {
          scene.cameras?.nextCamera();
          onCameraChange();
          // Held movement belongs to each camera, so tell the new one about
          // keys that are still down.
          updateCameraMovement();
        }
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
      if (scriptKeys.delete(evt.code)) {
        updateScriptKeys();
      }

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
        scriptKeys.clear();
        updateScriptKeys();
      }
    });
}
