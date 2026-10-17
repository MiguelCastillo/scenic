import {
  ready as domReady,
  events as domEvents,
  InputCapture,
  registerKeyboardMouseIntents,
  registerTouchIntents,
} from "@scenic/dom";
import {webgl} from "@scenic/renderer";
import {loadScene, SceneRunner, SceneStack} from "@scenic/runtime";

import {PlayOnTap, PlayWhileLocked, registerSceneInputRouting} from "./input.js";
import {RoomConnection} from "./room.js";

// The arcade plays one of the games in games/, full screen: the one the page's
// URL names, such as index.html?game=bubble-squadron, or, without one, the one
// the player chooses on its welcome screen, a scene of the arcade's own
// (welcome.json) with a menu of the games. It reads the game's game.json (see
// games/README.md) and runs the scene the game starts in, with the game's
// HUD over it.
//
// A game with a menu (game.json's "menu") opens with its menu scene stacked
// over the game, on a scene stack (see SceneStack in @scenic/runtime): the
// game shows paused behind it, and the menu has the keyboard. The menu scene
// publishes the menu on its "menu" channel (see menu.js in
// resources/scripts), which the arcade shows as a list, and picking a choice
// goes to the scene it names, such as another track: it is loaded in the
// game's place, unless it is the one playing, and the menu closes. M opens
// the menu again, and Escape closes it.

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
  const pauseEl = document.querySelector("#pause");
  const roomEl = document.querySelector("#room");
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

  // The page receives what the scenes publish for it on sceneManager.ui,
  // such as a menu's choices, in its own loop: its receivers pull from the
  // scenes once an animation frame, when the page is ready to show what they
  // publish. receiveEveryFrame adds receive to the loop, and returns a
  // function that takes it out.
  const receivers = new Set();
  requestAnimationFrame(function receiveFromScenes() {
    receivers.forEach((receive) => receive());
    requestAnimationFrame(receiveFromScenes);
  });
  const receiveEveryFrame = (receive) => {
    receivers.add(receive);
    return () => receivers.delete(receive);
  };

  // The page's input goes to the scenes on the stack. The keyboard, mouse
  // and touches become intents (see input-intents.js in @scenic/dom), for
  // the top scene: camera intents while it is the game, and menu intents
  // while it is a menu, which has no cameras. The keys and mouse also go to
  // the scenes as they are, for scripts that read them, such as a ship's
  // flight controls (see input.js).
  const capture = new InputCapture(canvas);
  const intentOptions = {
    getContext: () => (stack.runners.at(-1)?.cameras ? "camera" : "menu"),
    onIntent: (intent) => stack.runners.at(-1)?.sceneManager.input.publish("player", intent),
  };
  registerKeyboardMouseIntents(capture, intentOptions);
  registerTouchIntents(capture, intentOptions);
  registerSceneInputRouting(capture, () => stack.runners);

  // Clicking or tapping a choice in a menu picks it.
  domEvents.Subscription.create(menuEl).on("click", (evt) => {
    const index = [...menuEl.querySelectorAll("li")].indexOf(evt.target.closest("li"));
    if (index !== -1) {
      intentOptions.onIntent({type: "choose", index});
    }
  });

  // showMenu shows a menu's message (see menu.js in resources/scripts): its
  // title, its choices, with the selected one marked, and its hint, redrawn
  // only when they change.
  let shownMenu = null;
  const showMenu = (message) => {
    const key = JSON.stringify(message);
    if (key === shownMenu) {
      return;
    }
    shownMenu = key;
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
  };
  const hideMenu = () => {
    shownMenu = null;
    menuEl.replaceChildren();
  };

  // showWelcome shows the welcome scene at url, such as the arcade's, to
  // choose a game, or a game's, to choose a track, until the player picks a
  // choice in its menu, and resolves with where the choice goes: a game's
  // folder in games/, or a track's scene file, relative to the game's folder.
  const showWelcome = async (url) => {
    const scene = await loadScene(gl, await fetchJSON(url), {sceneURL: url.href});
    stack.push(new SceneRunner(gl, scene, {paused: false}));
    document.body.classList.add("menu-open");
    messageEl.textContent = "";
    const chosen = await new Promise((resolve) => {
      const stopReceiving = receiveEveryFrame(() => {
        const message = scene.sceneManager.ui.latest("menu");
        if (message?.picked) {
          stopReceiving();
          resolve(message.picked.goTo);
        } else if (message) {
          showMenu(message);
        }
      });
    });
    stack.pop();
    scene.dispose();
    hideMenu();
    document.body.classList.remove("menu-open");
    return chosen;
  };

  // Where the player is goes in the page's URL as they go, the game and the
  // scene playing, such as ?game=bubble-squadron&scene=highway.json, so that
  // reloading the page comes back to it, and each step is a page in the
  // browser's history. Going back or forward loads the page again from the
  // URL it goes to.
  const params = new URLSearchParams(location.search);
  const pushToURL = (name, value) => {
    const url = new URL(location.href);
    url.searchParams.set(name, value);
    history.pushState(null, "", url);
  };
  domEvents.Subscription.create(window).on("popstate", () => location.reload());

  // Players who open the arcade with the same ?room= play together, through
  // the relay (see room.js). The page shows the room and how many are in it.
  const roomName = params.get("room");
  if (roomName) {
    roomEl.textContent = `Room ${roomName} · joining…`;
    new RoomConnection(roomName, {
      onChange: ({connected, players}) => {
        roomEl.textContent = connected
          ? `Room ${roomName} · ${players.length + 1} playing`
          : `Room ${roomName} · not connected`;
      },
    });
  }

  let game = params.get("game");
  try {
    if (!game) {
      game = await showWelcome(new URL("welcome.json", location.href));
      pushToURL("game", game);
    }
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
    let stopReceivingHud = null;
    const play = (loaded) => {
      hudEl.textContent = "";
      stopReceivingHud?.();
      stopReceivingHud = receiveEveryFrame(() => {
        const text = Object.entries(loaded.scene.sceneManager.ui.messages())
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
    // A game opens on the scene the URL names, or, without one, on its
    // welcome scene, to choose the track to play, or on the scene it starts
    // in.
    let gameFile = params.get("scene");
    if (!gameFile && manifest.welcome) {
      gameFile = await showWelcome(new URL(manifest.welcome, manifestURL));
      pushToURL("scene", gameFile);
    }
    gameFile = gameFile || manifest.scene;
    messageEl.textContent = `Loading ${manifest.name}…`;
    let playing = play(await load(gameFile));
    stack.push(playing.runner);

    // The menu scene, while it is open, over the game, and whether it is
    // going to the scene picked in it.
    let menu = null;
    let going = false;

    // The game plays while the player has it: on a touch screen, from a tap
    // until the pause button, and otherwise while the pointer is locked to
    // it. The page tells the player what to do.
    const touchScreen = matchMedia("(pointer: coarse)").matches;
    const playPolicy = touchScreen
      ? new PlayOnTap(
          capture,
          () => stack.runners,
          ({paused}) => {
            messageEl.textContent = menu ? "" : paused ? `${manifest.name}\nTap to play` : "";
            pauseEl.hidden = !!menu || paused;
          }
        )
      : new PlayWhileLocked(
          capture,
          () => stack.runners,
          ({locked, paused}) => {
            messageEl.textContent = menu
              ? ""
              : !locked
              ? `${manifest.name}\nClick to play`
              : paused
              ? "Paused\nPress P to play"
              : "";
          }
        );
    domEvents.Subscription.create(pauseEl).on("click", () => playPolicy.pause());

    const closeMenu = () => {
      menu.stopReceiving();
      stack.pop();
      menu.scene.dispose();
      menu = null;
      going = false;
      hideMenu();
      document.body.classList.remove("menu-open");
      playPolicy.reset();
    };

    // openMenu stacks the menu over the game, and lets go of the pointer,
    // which pauses the game. The menu shows what its scene publishes on its
    // "menu" channel, and goes where a pick says.
    const openMenu = async () => {
      if (!manifest.menu || menu) {
        return;
      }
      capture.unlock();
      document.body.classList.add("menu-open");
      menu = await load(manifest.menu, {paused: false});
      menu.stopReceiving = receiveEveryFrame(async () => {
        const message = menu.scene.sceneManager.ui.latest("menu");
        if (!message || going) {
          return;
        }

        // Leaving the menu closes it.
        if (message.back) {
          closeMenu();
          return;
        }

        // A pick loads its scene in the game's place, unless it is the one
        // playing, and closes the menu.
        if (message.picked) {
          going = true;
          const file = message.picked.goTo;
          if (file !== gameFile) {
            hideMenu();
            messageEl.textContent = "Loading…";
            const next = play(await load(file));
            stack.replace(0, next.runner);
            playing.scene.dispose();
            playing = next;
            gameFile = file;
            pushToURL("scene", file);
          }
          closeMenu();
          return;
        }

        showMenu(message);
      });
      stack.push(menu.runner);
      playPolicy.reset();
    };

    // M opens the menu. The menu closes itself, when the player leaves it.
    capture.onInput((event) => {
      if (event.type === "keydown" && !event.repeat && !menu && event.code === "KeyM") {
        openMenu();
      }
    });

    // Without a welcome scene to choose the track on, or a scene in the URL,
    // the game opens with its menu over it.
    if (manifest.menu && !manifest.welcome && !params.get("scene")) {
      await openMenu();
    } else {
      playPolicy.reset();
    }
  } catch (ex) {
    messageEl.textContent = `Unable to play "${game}"\n${ex.message}`;
    throw ex;
  }
});
