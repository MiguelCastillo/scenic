import {ready as domReady, events as domEvents} from "@scenic/dom";
import {webgl} from "@scenic/renderer";
import {loadScene, SceneRunner, SceneStack} from "@scenic/runtime";

import {subscribeToSceneInput} from "./input.js";

// The arcade plays one of the games in games/, full screen: the one the page's
// URL names, such as index.html?game=bubble-squadron, or this one without
// one. It reads the game's game.json (see games/README.md) and runs the scene
// the game starts in, with the game's HUD over it.
//
// A game with a menu (game.json's "menu") opens with its menu scene stacked
// over the game, on a scene stack (see SceneStack in @scenic/runtime): the
// game shows paused behind it, and the menu has the keyboard. The menu scene
// publishes the menu on its "menu" channel (see menu.js in
// resources/scripts), which the arcade shows as a list, and picking a choice
// goes to the scene it names, such as another track: it is loaded in the
// game's place, unless it is the one playing, and the menu closes. M opens
// the menu again, and Escape closes it.
const defaultGame = "bubble-squadron";

// Keys the menu uses, which the page shouldn't, such as to scroll.
const menuKeys = new Set(["ArrowUp", "ArrowDown", "Enter", "Space"]);

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
// SceneManager in @scenic/scene), from its messages. Channels not here don't
// show.
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
  const menuEl = document.querySelector("#menu");
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

  const stack = new SceneStack(gl);
  const game = new URLSearchParams(location.search).get("game") || defaultGame;
  try {
    const manifestURL = new URL(`/games/${game}/game.json`, location.href);
    const manifest = await fetchJSON(manifestURL);
    document.title = manifest.name;
    messageEl.textContent = `Loading ${manifest.name}…`;

    // load loads one of the game's scenes, by its file, relative to the
    // game's folder, as are the scripts in it, with a runner for the stack:
    // {scene, runner}. Scenes run paused, so the game doesn't run until the
    // player clicks to play (see input.js).
    const load = async (file, options) => {
      const url = new URL(file, manifestURL);
      const scene = await loadScene(gl, await fetchJSON(url), {sceneURL: url.href});
      return {scene, runner: new SceneRunner(gl, scene, options)};
    };

    // play makes loaded the game's scene, at the bottom of the stack. Its
    // HUD shows what it published last frame on the channels the arcade
    // knows, such as a race's lap and time, a blank line apart, and its
    // frame rate shows too.
    const play = (loaded) => {
      hudEl.textContent = "";
      loaded.scene.sceneManager.ui.onUpdate((messages) => {
        const text = Object.entries(messages)
          .map(([channel, message]) => hudTexts[channel]?.(message))
          .filter(Boolean)
          .join("\n\n");
        if (hudEl.textContent !== text) {
          hudEl.textContent = text;
        }
      });
      loaded.runner.registerRefreshRateUpdater((fps) => {
        fpsEl.textContent = fps;
      });
      return loaded;
    };
    let gameFile = manifest.scene;
    let playing = play(await load(gameFile));
    stack.push(playing.runner);

    // The menu scene, while it is open, over the game, the keys held down
    // in it, and whether it is going to the scene picked in it.
    let menu = null;
    const menuHeld = new Set();
    let going = false;

    const input = subscribeToSceneInput(
      canvas,
      () => playing.runner,
      ({locked, paused}) => {
        messageEl.textContent = menu
          ? ""
          : !locked
          ? `${manifest.name}\nClick to play`
          : paused
          ? "Paused\nPress P to play"
          : "";
      },
      () => !menu
    );

    const closeMenu = () => {
      stack.pop();
      menu.scene.dispose();
      menu = null;
      menuHeld.clear();
      going = false;
      menuEl.replaceChildren();
      document.body.classList.remove("menu-open");
      input.reset();
    };

    // openMenu stacks the menu over the game, and lets go of the pointer,
    // which pauses the game. The menu shows what its scene publishes on its
    // "menu" channel, and goes where a pick says.
    const openMenu = async () => {
      if (!manifest.menu || menu) {
        return;
      }
      document.exitPointerLock();
      document.body.classList.add("menu-open");
      menu = await load(manifest.menu, {paused: false});
      let shown = null;
      menu.scene.sceneManager.ui.onUpdate(async ({menu: message}) => {
        if (!message || going) {
          return;
        }

        // A pick loads its scene in the game's place, unless it is the one
        // playing, and closes the menu.
        if (message.picked) {
          going = true;
          const file = message.picked.goTo;
          if (file !== gameFile) {
            menuEl.replaceChildren();
            messageEl.textContent = "Loading…";
            const next = play(await load(file));
            stack.replace(0, next.runner);
            playing.scene.dispose();
            playing = next;
            gameFile = file;
          }
          closeMenu();
          return;
        }

        // The menu shows its title, its choices, with the selected one
        // marked, and its hint, redrawn only when they change.
        const key = JSON.stringify(message);
        if (key === shown) {
          return;
        }
        shown = key;
        const {title, choices, selected, hint} = message;
        const titleEl = document.createElement("div");
        titleEl.className = "menu-title";
        titleEl.textContent = title;
        const listEl = document.createElement("ul");
        choices.forEach(({label}, i) => {
          const choiceEl = document.createElement("li");
          choiceEl.textContent = label;
          choiceEl.classList.toggle("selected", i === selected);
          listEl.appendChild(choiceEl);
        });
        const hintEl = document.createElement("div");
        hintEl.className = "menu-hint";
        hintEl.textContent = hint;
        menuEl.replaceChildren(titleEl, listEl, ...(hint ? [hintEl] : []));
      });
      stack.push(menu.runner);
      input.reset();
    };

    // While the menu is open, the keyboard is the menu's.
    domEvents.Subscription.create(document)
      .on("keydown", (evt) => {
        if (menu) {
          if (evt.code === "Escape") {
            if (!going) {
              closeMenu();
            }
            return;
          }
          if (menuKeys.has(evt.code)) {
            evt.preventDefault();
          }
          menuHeld.add(evt.code);
          menu.runner.setHeldKeys(menuHeld);
        } else if (evt.code === "KeyM" && !evt.repeat) {
          openMenu();
        }
      })
      .on("keyup", (evt) => {
        // A quick tap can go down and up between two frames, so a key is let
        // go of after the next frame is drawn, for the menu to see it.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            menuHeld.delete(evt.code);
            menu?.runner.setHeldKeys(menuHeld);
          })
        );
      });

    if (manifest.menu) {
      await openMenu();
    } else {
      input.reset();
    }
  } catch (ex) {
    messageEl.textContent = `Unable to play "${game}"\n${ex.message}`;
    throw ex;
  }
});
