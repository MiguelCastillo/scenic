import {ready as domReady, events as domEvents} from "@scenic/dom";
import {webgl} from "@scenic/renderer";
import {loadScene, SceneRunner, startRenderLoop} from "@scenic/runtime";

import {subscribeToSceneInput} from "./input.js";

// The arcade plays one of the games in games/, full screen: the one the page's
// URL names, such as index.html?game=bubble-squadron, or this one without
// one. It reads the game's game.json (see games/README.md) and runs the scene
// the game starts in, with the game's HUD over it.
const defaultGame = "bubble-squadron";

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

// What the HUD shows for each channel of the scene's sceneManager.ui (see
// UiBus in @scenic/scene), from its messages. Channels not here don't show.
const hudTexts = {race: raceText};

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`unable to load ${url.pathname}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

domReady.onReady(async () => {
  const canvas = document.querySelector("#canvas");
  const hudEl = document.querySelector("#hud");
  const fpsEl = document.querySelector("#fps");
  const messageEl = document.querySelector("#message");
  const gl = webgl.createContext(canvas);

  // Keep the canvas drawing buffer the same size as the canvas is displayed so
  // rendering is not stretched. Cameras rebuild their projections from the
  // drawing buffer size every frame, so they pick up the new size on their own.
  const resizeCanvas = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  };
  resizeCanvas();
  domEvents.Subscription.create(window).on("resize", resizeCanvas);

  const game = new URLSearchParams(location.search).get("game") || defaultGame;
  try {
    const manifestURL = new URL(`/games/${game}/game.json`, location.href);
    const manifest = await fetchJSON(manifestURL);
    document.title = manifest.name;
    messageEl.textContent = `Loading ${manifest.name}…`;

    // The game's scene, and the scripts in it, are relative to its folder.
    // Scenes run paused, so the game doesn't run until the player clicks to
    // play (see input.js).
    const sceneURL = new URL(manifest.scene, manifestURL);
    const runner = new SceneRunner(
      gl,
      await loadScene(gl, await fetchJSON(sceneURL), {sceneURL: sceneURL.href})
    );
    startRenderLoop(gl, runner);

    // The HUD shows what the scene publishes on the channels it knows, such
    // as a race's lap and time, a blank line apart, in the order they first
    // came.
    const hud = new Map();
    runner.sceneManager.ui.onUpdate((channel, message) => {
      const text = hudTexts[channel]?.(message);
      if (text === undefined || hud.get(channel) === text) {
        return;
      }
      hud.set(channel, text);
      hudEl.textContent = [...hud.values()].filter(Boolean).join("\n\n");
    });
    runner.registerRefreshRateUpdater((fps) => {
      fpsEl.textContent = fps;
    });

    subscribeToSceneInput(canvas, runner, ({locked, paused}) => {
      messageEl.textContent = !locked
        ? `${manifest.name}\nClick to play`
        : paused
        ? "Paused\nPress P to play"
        : "";
    });
  } catch (ex) {
    messageEl.textContent = `Unable to play "${game}"\n${ex.message}`;
    throw ex;
  }
});
