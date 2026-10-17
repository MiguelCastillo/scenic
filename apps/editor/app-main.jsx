import React from "react";
import {createRoot} from "react-dom/client";
import {
  ready as domReady,
  events as domEvents,
  InputCapture,
  registerKeyboardMouseIntents,
} from "@scenic/dom";
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
  "/games/bubble-squadron/welcome.json",
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
// SceneManager in @scenic/scene), from its messages. Channels not here don't
// show.
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

  // The page's input goes to the current scene while the pointer is locked
  // to the mousetrap, by clicking it, so typing in the editor's panels is
  // left alone: the keyboard and mouse as intents (see input-intents.js in
  // @scenic/dom), for its cameras or, in a scene without them, its menu, and
  // as they are, for scripts that read them. Escape lets the pointer go, and
  // P pauses and resumes the scene.
  const capture = new InputCapture(document.getElementById("mousetrap"));
  registerKeyboardMouseIntents(capture, {
    getContext: () => (currentScene?.runner.cameras ? "camera" : "menu"),
    onIntent: (intent) => {
      if (capture.locked) {
        currentScene?.runner.sceneManager.input.publish("player", intent);
      }
    },
  });
  registerSceneInputRouting(capture, () => currentScene?.runner);
  capture.onInput((event) => {
    const runner = currentScene?.runner;
    if (event.type === "click") {
      capture.lock();
    } else if (
      runner &&
      capture.locked &&
      event.type === "keydown" &&
      event.code === pauseKey &&
      !event.repeat
    ) {
      showPaused(runner.togglePause());
    }
  });

  // renderSceneGraph renders the scene graph panel for the current scene. It
  // is rendered again when the active camera changes, so that the panels show
  // it. Rendering the same SceneGraph again keeps its state, such as the
  // selected node.
  // The page receives what the current scene publishes for it in its own
  // loop, pulling once an animation frame, when it is ready to show it: the
  // HUD shows what the scene published on sceneManager.ui on the channels it
  // knows, such as a
  // race's lap and time, a blank line apart, and the scene graph is rendered
  // again when the active camera changes, such as when C switches cameras,
  // since it shows which one is active.
  let activeCamera = null;
  requestAnimationFrame(function receiveFromScene() {
    if (currentScene) {
      const text = Object.entries(currentScene.scene.sceneManager.ui.messages())
        .map(([channel, message]) => hudTexts[channel]?.(message))
        .filter(Boolean)
        .join("\n\n");
      if (hudEl.textContent !== text) {
        hudEl.textContent = text;
      }

      const {cameras} = currentScene.runner;
      if (cameras && cameras.activeCamera !== activeCamera) {
        activeCamera = cameras.activeCamera;
        renderSceneGraph();
      }
    }
    requestAnimationFrame(receiveFromScene);
  });

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

// The key that pauses and resumes the scene.
const pauseKey = "KeyP";

// registerSceneInputRouting gives what capture catches to the runner
// getRunner returns while the pointer is locked, as its scene's player's
// input, on the "player" channel of its sceneManager.input (see SceneManager
// in @scenic/scene), which moves its cameras and its scripts, such as a
// rocket's flight controls. It asks getRunner every time, so another scene
// can be opened. The keys held down go up when the pointer is let go, since
// their keyups never come. It returns a function that stops the routing.
function registerSceneInputRouting(capture, getRunner) {
  // The keys held down, with the runner each went down in.
  const runnersByHeldKey = new Map();
  const publish = (runner, event) => runner.sceneManager.input.publish("player", event);

  return capture.onInput((event) => {
    const runner = getRunner();
    switch (event.type) {
      case "keydown":
        if (runner && capture.locked && !runnersByHeldKey.has(event.code)) {
          runnersByHeldKey.set(event.code, runner);
          publish(runner, {type: "keydown", code: event.code});
        }
        break;
      case "keyup":
        if (runnersByHeldKey.has(event.code)) {
          publish(runnersByHeldKey.get(event.code), {type: "keyup", code: event.code});
          runnersByHeldKey.delete(event.code);
        }
        break;
      case "mousemove":
      case "wheel":
        if (runner && capture.locked) {
          publish(runner, {type: event.type, x: event.x, y: event.y});
        }
        break;
      case "pointerlock":
        if (!event.locked) {
          runnersByHeldKey.forEach((heldRunner, code) =>
            publish(heldRunner, {type: "keyup", code})
          );
          runnersByHeldKey.clear();
        }
        break;
    }
  });
}
