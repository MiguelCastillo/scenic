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
import {RoomConnection, connecting, connected, disconnected} from "./room.js";
import {RemotePlayers} from "./remote-players.js";
import {Ships, replaceShip} from "./ships.js";

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
// resources/scripts), which the arcade shows as a list. Picking a choice
// goes to the scene it names, such as another track: it is loaded in the
// game's place, unless it is the one playing, and the menu closes. A choice
// can instead resume, which closes the menu, or leave, which goes back to
// the game's welcome page, such as Bubble Squadron's pause menu. M opens the
// menu again, as does the pause button on a touch screen, and Escape closes
// it.

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
  const roomStatusEl = document.querySelector("#room-status");
  const roomConnectEl = document.querySelector("#room-connect");
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

  // Clicking or tapping a choice in a menu picks it, and a carousel's
  // buttons send the intents their keys would, such as the arrows moving to
  // the next choice.
  domEvents.Subscription.create(menuEl).on("click", (evt) => {
    const button = evt.target.closest("[data-intent]");
    if (button) {
      intentOptions.onIntent(JSON.parse(button.dataset.intent));
      return;
    }
    const index = [...menuEl.querySelectorAll("li")].indexOf(evt.target.closest("li"));
    if (index !== -1) {
      intentOptions.onIntent({type: "choose", index});
    }
  });

  // showMenu shows a menu's message (see menu.js in resources/scripts),
  // from the menu scene at sceneURL: its title, its choices, with the
  // selected one marked, and its hint, redrawn only when they change. A
  // carousel is in two parts: a panel, on the left, with its title and its
  // actions, such as Race and Back, and the stage, on the right, under what
  // is being chosen, such as a ship, with its name and how many there are
  // between arrows to the choices beside it. A choice with a picture, such
  // as a track's, shows it on the stage, above its name, from its image,
  // relative to the menu scene's file.
  // A menu that is new, rather than one with another choice selected, is
  // marked "opening", so that it pops in (see arcade.css).
  let shownMenu = null;
  let shownChoices = null;
  const showMenu = (message, sceneURL) => {
    const key = JSON.stringify(message);
    if (key === shownMenu) {
      return;
    }
    shownMenu = key;
    const {title, choices, selected, hint, layout, actions, action} = message;
    const choicesKey = JSON.stringify({title, choices, layout, actions});
    menuEl.classList.toggle("opening", choicesKey !== shownChoices);
    shownChoices = choicesKey;
    const titleEl = document.createElement("div");
    titleEl.className = "menu-title";
    titleEl.textContent = title;
    menuEl.classList.toggle("carousel", layout === "carousel");
    if (layout === "carousel") {
      // The panel lists the actions, each sending the intent that takes it
      // when clicked, whichever is selected.
      const actionsEl = document.createElement("ul");
      actions.forEach(({label, back}, i) => {
        const actionEl = document.createElement("li");
        actionEl.textContent = label;
        actionEl.style.setProperty("--i", i);
        actionEl.classList.toggle("selected", i === action);
        actionEl.dataset.intent = JSON.stringify(
          back ? {type: "back"} : {type: "choose", index: selected}
        );
        actionsEl.appendChild(actionEl);
      });
      const panelEl = document.createElement("div");
      panelEl.className = "carousel-panel";
      panelEl.append(titleEl, actionsEl);

      // The stage is under what is being chosen, with its name and how many
      // there are between arrows to the choices beside it.
      const arrow = (label, x, className) => {
        const arrowEl = document.createElement("button");
        arrowEl.textContent = label;
        arrowEl.className = `carousel-arrow ${className}`;
        arrowEl.dataset.intent = JSON.stringify({type: "navigate", x, y: 0});
        return arrowEl;
      };
      const labelEl = document.createElement("div");
      labelEl.className = "carousel-label";
      labelEl.textContent = choices[selected]?.label ?? "";
      const countEl = document.createElement("div");
      countEl.className = "carousel-count";
      countEl.textContent = `${selected + 1} of ${choices.length}`;
      const captionEl = document.createElement("div");
      captionEl.className = "carousel-caption";
      captionEl.append(labelEl, countEl);
      const stageEl = document.createElement("div");
      stageEl.className = "carousel-stage";
      const image = choices[selected]?.image;
      if (image) {
        const pictureEl = document.createElement("img");
        pictureEl.className = "carousel-picture";
        pictureEl.src = new URL(image, sceneURL).href;
        pictureEl.alt = "";
        captionEl.prepend(pictureEl);
        stageEl.classList.add("with-picture");
      }
      stageEl.append(
        arrow("‹", -1, "carousel-previous"),
        captionEl,
        arrow("›", 1, "carousel-next")
      );
      menuEl.replaceChildren(panelEl, stageEl);
      return;
    }
    const listEl = document.createElement("ul");
    choices.forEach(({label}, i) => {
      const choiceEl = document.createElement("li");
      choiceEl.textContent = label;
      choiceEl.style.setProperty("--i", i);
      choiceEl.classList.toggle("selected", i === selected);
      listEl.appendChild(choiceEl);
    });
    const hintEl = document.createElement("div");
    hintEl.className = "menu-hint";
    hintEl.textContent = hint;
    menuEl.replaceChildren(titleEl, listEl, ...(hint ? [hintEl] : []));
    listEl.children[selected]?.scrollIntoView({block: "nearest"});
  };
  const hideMenu = () => {
    shownMenu = null;
    shownChoices = null;
    menuEl.classList.remove("carousel");
    menuEl.replaceChildren();
  };

  // showWelcome shows the welcome scene at url, such as the arcade's, to
  // choose a game, a game's, to choose a track, or its hangar, to choose a
  // ship, until the player picks a choice in its menu, and resolves with the
  // choice, such as {label, goTo}, with where it goes: a game's folder in
  // games/, or a track's scene file, relative to the game's folder.
  //
  // Options:
  // - choices: the menu's choices, in place of the ones in the scene file,
  //   such as the game's ships.
  // - onSelect: called with the selected choice whenever another one is
  //   selected, such as to show the ship it is.
  // - allowBack: whether the player can leave the menu, such as with Escape
  //   or a Back button, which resolves with {back: true}. false by default.
  const showWelcome = async (url, {choices, onSelect, allowBack = false} = {}) => {
    const scene = await loadScene(gl, await fetchJSON(url), {sceneURL: url.href});
    if (choices) {
      const {stateManager} = scene.sceneManager;
      Object.values(stateManager.getAllItemsByName())
        .filter(({hud}) => hud === "menu")
        .forEach(({id, script}) =>
          stateManager.updateItemByID(id, {
            script: {...script, settings: {...script.settings, choices}},
          })
        );
    }
    stack.push(new SceneRunner(gl, scene, {paused: false}));
    document.body.classList.add("menu-open");
    messageEl.textContent = "";
    let selected = null;
    const chosen = await new Promise((resolve) => {
      const stopReceiving = receiveEveryFrame(() => {
        const message = scene.sceneManager.ui.latest("menu");
        if (message?.picked) {
          stopReceiving();
          resolve(message.picked);
        } else if (message?.back && allowBack) {
          stopReceiving();
          resolve({back: true});
        } else if (message) {
          showMenu(message, url);
          if (message.selected !== selected) {
            selected = message.selected;
            onSelect?.(message.choices[selected], scene);
          }
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
  // the relay (see room.js). The page shows the room and how many are in it,
  // or that it is connecting, such as while the server restarts, when the
  // others' copies are taken out until they are heard from again. Once the
  // connection gives up, a button connects again.
  // While a game that can be played together is playing, the page receives
  // what its player's node publishes on the scene's sceneManager.network, on
  // the channel the node's "network" names: 20 times a second, it pulls the
  // latest message and sends it to the others. The others' messages are
  // published to their copies in the scene (see RemotePlayers). What the
  // messages hold is the game's business.
  const roomName = params.get("room");
  // Where the page receives its player's messages from, while a game is
  // playing that can be played together: the scene playing, its file, the
  // channel, and the ship the player flies, if they chose one, as {scene,
  // file, channel, ship}.
  let networkSource = null;
  let remotePlayers = null;
  if (roomName) {
    roomEl.hidden = false;
    const room = new RoomConnection(roomName, {
      onChange: ({status, otherPlayerIDs}) => {
        roomStatusEl.textContent = {
          [connecting]: `Room ${roomName} · connecting…`,
          [connected]: `Room ${roomName} · ${otherPlayerIDs.length + 1} playing`,
          [disconnected]: `Room ${roomName} · disconnected`,
        }[status];
        roomConnectEl.hidden = status !== disconnected;
        remotePlayers?.keep(otherPlayerIDs);
      },
      onMessage: (playerID, message) => remotePlayers?.publishToScene(playerID, message),
    });
    domEvents.Subscription.create(roomConnectEl).on("click", () => room.connect());
    setInterval(() => {
      const message = networkSource?.scene.sceneManager.network.latest(networkSource.channel);
      if (message !== undefined) {
        room.send({scene: networkSource.file, ship: networkSource.ship, message});
      }
    }, 50);
  }

  let game = params.get("game");
  try {
    if (!game) {
      game = (await showWelcome(new URL("welcome.json", location.href))).goTo;
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

    // The ships the player can choose from, for a game with a hangar, and the
    // one they chose, from the URL, such as &ship=saucer.
    const ships = manifest.ships ? await Ships.load(new URL(manifest.ships, manifestURL)) : null;
    let shipID = params.get("ship");

    // loadGame loads one of the game's scenes to play, by its file, with the
    // player's node, the one the manifest names in "player", flying the ship
    // they chose, if they chose one.
    const loadGame = async (file) => {
      const loaded = await load(file);
      if (shipID) {
        await replaceShip(loaded.scene, manifest.player, await ships.shipConfig(shipID));
      }
      return loaded;
    };

    // play makes loaded, from the game's scene file, the game's scene, at the
    // bottom of the stack. Its HUD shows what it published last frame on the
    // channels the arcade knows, such as a race's lap and time, a blank line
    // apart, and its frame rate shows too. In a room, the other players show
    // in it, if the game can be played together.
    let stopReceivingHud = null;
    const play = (loaded, file) => {
      remotePlayers?.dispose();
      remotePlayers = null;
      networkSource = null;
      if (roomName && manifest.multiplayer) {
        remotePlayers = new RemotePlayers(loaded.scene, file, {
          playerNodeID: manifest.player,
          remoteScript: manifest.multiplayer.remote,
          ships,
        });
        networkSource = {
          scene: loaded.scene,
          file,
          channel: loaded.scene.sceneManager.getNodeStateByID(manifest.player)?.network,
          ship: shipID,
        };
      }
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
    // in. Back goes back to choosing a game, by loading the page without
    // the game in its URL.
    let gameFile = params.get("scene");
    if (!gameFile && manifest.welcome) {
      const picked = await showWelcome(new URL(manifest.welcome, manifestURL), {allowBack: true});
      if (picked.back) {
        const url = new URL(location.href);
        url.searchParams.delete("game");
        location.assign(url);
        return;
      }
      gameFile = picked.goTo;
      pushToURL("scene", gameFile);
    }
    gameFile = gameFile || manifest.scene;

    // A game with a hangar then opens on it, to choose the ship to race,
    // unless the URL names one. Its showcase ship shows the selected ship,
    // which starts facing the player, by turning its showcase turntable, if
    // it has one, back to the front, and Back goes back to choosing the
    // track, by loading the page without the track in its URL.
    if (manifest.hangar && !ships.find(shipID)) {
      // The ship to show, and whether it is being shown, so that selecting
      // ships quickly shows the last one selected, once.
      let shipToShow = null;
      let showing = false;
      const showShip = async (scene) => {
        if (showing) {
          return;
        }
        showing = true;
        for (let shown = null; shown !== shipToShow; ) {
          shown = shipToShow;
          await replaceShip(scene, "showcase ship", await ships.shipConfig(shown));
          const {sceneManager} = scene;
          const turntable = sceneManager.getNodeStateByID("showcase turntable");
          if (turntable) {
            sceneManager.updateNodeStateByID("showcase turntable", {
              transform: {...turntable.transform, rotation: [0, 0, 0]},
              script: {...turntable.script, settings: {...turntable.script.settings, angle: 0}},
            });
          }
        }
        showing = false;
      };
      const picked = await showWelcome(new URL(manifest.hangar, manifestURL), {
        choices: ships.list.map(({id, label}) => ({label, ship: id})),
        allowBack: true,
        onSelect: (choice, scene) => {
          if (choice.ship) {
            shipToShow = choice.ship;
            showShip(scene);
          }
        },
      });
      if (picked.back) {
        const url = new URL(location.href);
        url.searchParams.delete("scene");
        location.assign(url);
        return;
      }
      shipID = picked.ship;
      pushToURL("ship", shipID);
    }
    messageEl.textContent = `Loading ${manifest.name}…`;
    let playing = play(await loadGame(gameFile), gameFile);
    stack.push(playing.runner);

    // The menu scene, while it is open, over the game, while it loads, and
    // whether it is going to the scene picked in it.
    let menu = null;
    let menuLoading = null;
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
      if (!manifest.menu || menu || menuLoading) {
        return;
      }
      capture.unlock();
      document.body.classList.add("menu-open");
      menuLoading = load(manifest.menu, {paused: false});
      menu = await menuLoading;
      menuLoading = null;
      menu.stopReceiving = receiveEveryFrame(async () => {
        const message = menu.scene.sceneManager.ui.latest("menu");
        if (!message || going) {
          return;
        }

        // Leaving the menu, or resuming the race, closes it.
        if (message.back || message.picked?.resume) {
          closeMenu();
          return;
        }

        // Leaving the race goes back to choosing a ship in the hangar, or,
        // in a game without one, a track on its welcome page, by loading the
        // page without the one chosen in its URL.
        if (message.picked?.leave) {
          going = true;
          const url = new URL(location.href);
          url.searchParams.delete(manifest.hangar ? "ship" : "scene");
          location.assign(url);
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
            const next = play(await loadGame(file), file);
            stack.replace(0, next.runner);
            playing.scene.dispose();
            playing = next;
            gameFile = file;
            pushToURL("scene", file);
          }
          closeMenu();
          return;
        }

        showMenu(message, new URL(manifest.menu, manifestURL));
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

    // On a touch screen, which has no keys, the pause button pauses the
    // game and opens the menu, as a pause menu.
    domEvents.Subscription.create(pauseEl).on("click", () => {
      playPolicy.pause();
      openMenu();
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
