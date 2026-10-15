import {ready as domReady, events as domEvents} from "@scenic/dom";
import {webgl} from "@scenic/renderer";
import {loadScene} from "@scenic/runtime";

import {subscribeToSceneInput} from "./input.js";

// The arcade plays one of the games in games/, full screen: the one the page's
// URL names, such as index.html?game=bubble-squadron, or this one without
// one. It reads the game's game.json (see games/README.md) and runs the scene
// the game starts in, with the game's HUD over it.
const defaultGame = "bubble-squadron";

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
    const sceneURL = new URL(manifest.scene, manifestURL);
    const scene = await loadScene(gl, await fetchJSON(sceneURL), sceneURL.href);

    scene.registerHudUpdater((text) => {
      hudEl.textContent = text;
    });

    subscribeToSceneInput(canvas, scene, ({locked, paused}) => {
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
