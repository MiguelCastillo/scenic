import {
  ready as domReady,
  events as domEvents,
  InputCapture,
  registerKeyboardMouseIntents,
  registerTouchIntents,
} from "@scenic/dom";
import {webgl} from "@scenic/renderer";
import {replaceShip, Ships} from "@scenic/racers";
import {loadScene, SceneRunner, SceneStack} from "@scenic/runtime";

import {PlayOnTap, PlayWhileLocked, registerSceneInputRouting} from "./input.js";
import {RoomConnection, connecting, connected, disconnected} from "./room.js";
import {RemotePlayers} from "./remote-players.js";

// The arcade plays one of the games in games/, full screen: the one the page's
// URL names, such as index.html?game=bubble-squadron, or, without one, the one
// the player chooses on its welcome screen, a scene of the arcade's own
// (welcome.json) with a menu of the games. It reads the game's game.json (see
// games/README.md) and runs the scene the game starts in, with the game's
// HUD over it.
//
// A game with a menu (game.json's "menu") opens with its menu scene stacked
// over the game, on a scene stack (see SceneStack in @scenic/runtime): the
// game shows paused behind it, and the menu has the keyboard. A race opens
// waiting for the player to join it, by clicking, which starts its
// countdown, and once it is under way the menu opens whenever it stops
// playing, such as when the player lets go of the pointer with Escape,
// presses M, or taps the pause button on a touch screen. The menu scene
// publishes the menu on its "menu" channel (see menu.js in
// resources/scripts), which the arcade shows as a list. Picking a choice
// goes to the scene it names, such as another track: it is loaded in the
// game's place, unless it is the one playing, and the menu closes. A choice
// can instead resume, which closes the menu and plays the game, restart,
// which loads the game's scene again and plays it, or leave, which goes
// back to choosing a ship or a track, such as Bubble Squadron's pause menu.
// A choice with solo shows only while the player plays alone, not in a
// room.

// clock is seconds as minutes, seconds and tenths, such as 1:05.3.
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;

// ordinal is a place as people say it, such as 1st or 2nd.
const ordinal = (n) =>
  `${n}${["th", "st", "nd", "rd"][n % 100 < 11 || n % 100 > 13 ? n % 10 : 0] ?? "th"}`;

// raceText is a race's message (see games/bubble-squadron/scripts/race.js)
// as the HUD shows it, once the race has started: the lap, time, place,
// with others racing, and next gate, and once the racer has finished, their
// time and place, and the results so far.
function raceText({lap, laps, time, gate, gates, best, finished, place, racers, results}) {
  const lines = finished
    ? [
        racers > 1 ? `Finished ${ordinal(place)} in ${clock(time)}` : `Finished in ${clock(time)}`,
        ...(racers > 1
          ? ["", ...results.map(({name, time}, i) => `${i + 1}. ${name} ${clock(time)}`)]
          : []),
      ]
    : lap === 0
    ? []
    : [
        `Lap ${lap}/${laps}   ${clock(time)}`,
        ...(racers > 1 ? [`Position ${place} of ${racers}`] : []),
        gate === 0
          ? lap === laps
            ? "Next: the finish"
            : "Next: the start gate"
          : `Next: gate ${gate} of ${gates}`,
      ];
  if (best != null && !finished) {
    lines.push(`Best ${clock(best)}`);
  }
  return lines.join("\n");
}

// countdownText is what a race's message shows in big in the middle of the
// screen: the seconds left before the start, then GO! for the first second
// of the race.
function countdownText({countdown, lap, time}) {
  return lap === 0 ? String(Math.ceil(countdown)) : lap === 1 && time < 1 ? "GO!" : "";
}

// boosterText is a ship's booster message (see
// games/bubble-squadron/scripts/fly.js) as the HUD shows it: that it is
// ready, and the key that fires it, while it can be fired, and that it is
// burning while it does.
function boosterText({ready, left}) {
  return left > 0 ? "BOOSTER!" : ready ? "Booster ready: press B" : "";
}

// What the HUD shows for each channel of the scene's sceneManager.ui (see
// SceneManager in @scenic/scene), from its messages. Channels not here don't
// show.
const hudTexts = {race: raceText, booster: boosterText};

// newRace makes a room on the server for a race of game's scene, such as
// "race.json", for a player racing alone, and resolves with its code (see
// server/src/rooms.js).
async function newRace(game, scene) {
  const response = await fetch(new URL("/rooms/new", location.href), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({game, scene}),
  });
  if (!response.ok) {
    throw new Error(`unable to start a race: ${response.status} ${response.statusText}`);
  }
  return (await response.json()).code;
}

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
  const countdownEl = document.querySelector("#countdown");
  const pauseEl = document.querySelector("#pause");
  const roomEl = document.querySelector("#room");
  const roomStatusEl = document.querySelector("#room-status");
  const roomConnectEl = document.querySelector("#room-connect");
  const friendsEl = document.querySelector("#friends");
  const friendsCodeEl = document.querySelector("#friends-code");
  const friendsErrorEl = document.querySelector("#friends-error");
  const lobbyEl = document.querySelector("#lobby");
  const lobbyTitleEl = document.querySelector("#lobby-title");
  const lobbyStatusEl = document.querySelector("#lobby-status");
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
      actions.forEach(({label}, i) => {
        const actionEl = document.createElement("li");
        actionEl.textContent = label;
        actionEl.style.setProperty("--i", i);
        actionEl.classList.toggle("selected", i === action);
        actionEl.dataset.intent = JSON.stringify({type: "act", index: i});
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

  // setMenuChoices sets the choices of the menus in scene, the nodes with
  // {"hud": "menu"}, to what choose returns for their own.
  const setMenuChoices = (scene, choose) => {
    const {stateManager} = scene.sceneManager;
    Object.values(stateManager.getAllItemsByName())
      .filter(({hud}) => hud === "menu")
      .forEach(({id, script}) =>
        stateManager.updateItemByID(id, {
          script: {
            ...script,
            settings: {...script.settings, choices: choose(script.settings.choices ?? [])},
          },
        })
      );
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
  // - confirm: called with a pick before it is taken, such as to ask more
  //   about it, while the scene stays on screen. It resolves with the pick
  //   to take, which can add to it, or null to go on choosing. Without it,
  //   picks are taken as they are.
  const showWelcome = async (url, {choices, onSelect, allowBack = false, confirm} = {}) => {
    const scene = await loadScene(gl, await fetchJSON(url), {sceneURL: url.href});
    if (choices) {
      setMenuChoices(scene, () => choices);
    }
    stack.push(new SceneRunner(gl, scene, {paused: false}));
    document.body.classList.add("menu-open");
    messageEl.textContent = "";
    let selected = null;
    // Whether a pick is being confirmed, while the menu waits.
    let confirming = false;
    const chosen = await new Promise((resolve) => {
      const stopReceiving = receiveEveryFrame(async () => {
        if (confirming) {
          return;
        }
        const message = scene.sceneManager.ui.latest("menu");
        if (message?.picked) {
          confirming = true;
          const taken = confirm ? await confirm(message.picked) : message.picked;
          confirming = false;
          if (taken) {
            stopReceiving();
            resolve(taken);
          }
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

  // chooseRace shows Race with friends, over the hangar, for a race of
  // game's scene, and resolves with the race the player chose, as {code,
  // scene}, its room's code and its scene, or null for Back (see ServeRooms
  // in server/src/rooms.js):
  // - Auto join puts them in a race on the same track with a seat free, or
  //   a new one others can be put in.
  // - Join by code joins a friend's race, on whatever track it is. A code
  //   that isn't a race, or a race that is full or of another game, says so
  //   and lets them try again.
  // - Start new race makes a race only those who know its code can join,
  //   which the lobby shows to read out to friends.
  // Escape goes back too.
  let finishChoosingRace = null;
  const chooseRace = (game, scene) =>
    new Promise((resolve) => {
      friendsCodeEl.value = "";
      friendsErrorEl.textContent = "";
      friendsEl.hidden = false;
      document.body.classList.add("friends-open");
      friendsEl.querySelector("button")?.focus();
      finishChoosingRace = async (choice) => {
        let race = null;
        try {
          if (choice === "auto" || choice === "new") {
            const response = await fetch(new URL(`/rooms/${choice}`, location.href), {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({game, scene}),
            });
            race = {code: (await response.json()).code, scene};
          } else if (choice === "join") {
            const code = friendsCodeEl.value.trim().toUpperCase();
            const response = await fetch(new URL(`/rooms/${code}`, location.href));
            const info = response.ok ? await response.json() : null;
            const problem = !code
              ? "Type a race's code"
              : !info
              ? `No race with the code ${code}`
              : info.full
              ? `Race ${code} is full`
              : info.game && info.game !== game
              ? `Race ${code} is another game's`
              : "";
            if (problem) {
              friendsErrorEl.textContent = problem;
              return;
            }
            race = {code: info.code, scene: info.scene || scene};
          }
        } catch (ex) {
          friendsErrorEl.textContent = "Unable to reach the races. Try again.";
          return;
        }
        finishChoosingRace = null;
        friendsEl.hidden = true;
        document.body.classList.remove("friends-open");
        resolve(race);
      };
    });
  domEvents.Subscription.create(friendsEl)
    .on("click", (evt) => {
      const choice = evt.target.closest("[data-race]")?.dataset.race;
      if (choice) {
        finishChoosingRace?.(choice);
      }
    })
    .on("submit", (evt) => {
      evt.preventDefault();
      finishChoosingRace?.("join");
    })
    .on("keydown", (evt) => {
      if (evt.key === "Escape") {
        finishChoosingRace?.("back");
      }
    });

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

  // Every race runs on the server, in a room (see room.js and
  // RemotePlayers): players who open the arcade with the same ?room= race
  // together, and a player racing alone races in a room of their own, with
  // no code. The page shows a shared room and how many are in it, or that
  // it is connecting, such as while the server restarts. Once the connection
  // gives up, a button connects again.
  //
  // A race's room only counts on the race's page, the one with its game,
  // its track and the ship the player races in, since every other page's
  // link is made from the one before it: a page without them, such as the
  // hangar, or one gone back to in the browser's history, leaves the room
  // out of its link, and doesn't join it. Reloading a race's page joins
  // its room again.
  const onRacePage = ["game", "scene", "ship"].every((name) => params.has(name));
  if (params.has("room") && !onRacePage) {
    const url = new URL(location.href);
    url.searchParams.delete("room");
    history.replaceState(null, "", url);
  }
  const roomName = onRacePage ? params.get("room") : null;
  // The race the server runs, while one is playing: the latest the server
  // said about it, {number, you, started, lobby, race, ships} (see
  // server/src/room-race.js), and the number of the race the player wants
  // to race, which is a later one to race again.
  let snapshot = null;
  let wantedRace = 0;
  let remotePlayers = null;
  // The number of the last message sent to the server, and when each of the
  // latest ones was sent, by its number, to match the server's answers to
  // where the player's ship was here (see fly.js).
  let seq = 0;
  const sentAtBySeq = new Map();
  // The server's latest answer about the player's own ship, until it goes
  // to the ship.
  let answer = null;

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
    // player clicks to play (see input.js). edit changes the scene's config
    // before it loads.
    const load = async (file, {edit = (config) => config, ...options} = {}) => {
      const url = new URL(file, manifestURL);
      const scene = await loadScene(gl, edit(await fetchJSON(url)), {sceneURL: url.href});
      return {scene, runner: new SceneRunner(gl, scene, options)};
    };

    // The ships the player can choose from, for a game with a hangar, and the
    // one they chose, from the URL, such as &ship=saucer.
    const ships = manifest.ships ? await Ships.load(new URL(manifest.ships, manifestURL)) : null;
    let shipID = params.get("ship");

    // racedOnServer is whether the scene file is one of the game's races,
    // which the server runs: one with NPCs, as the manifest says in "npcs":
    // {scenes}, in a game that can be played together.
    const racedOnServer = (file) =>
      !!manifest.multiplayer && !!manifest.npcs?.scenes?.includes(file);

    // heldByServer holds the player's node in a scene config, the one the
    // manifest names in "player", until the server, which runs the race,
    // says to let it go (see fly.js).
    const heldByServer = (config) => {
      const visit = (node) => {
        if ((node.id ?? node.name) === manifest.player) {
          node.held = true;
        }
        node.items?.forEach(visit);
      };
      config.items.forEach(visit);
      return config;
    };

    // loadGame loads one of the game's scenes to play, by its file, with the
    // player's node, the one the manifest names in "player", flying the ship
    // they chose, if they chose one, held until the server says, in a race.
    const loadGame = async (file) => {
      const loaded = await load(file, racedOnServer(file) ? {edit: heldByServer} : {});
      if (shipID) {
        await replaceShip(loaded.scene, manifest.player, await ships.shipConfig(shipID));
      }
      return loaded;
    };

    // play makes loaded, from the game's scene file, the game's scene, at the
    // bottom of the stack. Its HUD shows what it published last frame on the
    // channels the arcade knows, such as a race's lap and time, a blank line
    // apart, and its frame rate shows too. In a race, every racer shows in
    // it where the server says (see RemotePlayers).
    let stopReceivingHud = null;
    // Whether the game playing is under way, rather than waiting to start,
    // such as a race before its countdown ends, as its scene said last
    // frame. A game without a race is under way once it has run a frame.
    let underWay = false;
    const play = (loaded, file) => {
      remotePlayers?.dispose();
      remotePlayers = racedOnServer(file)
        ? new RemotePlayers(loaded.scene, {
            playerNodeID: manifest.player,
            remoteScript: manifest.multiplayer.remote,
            ships,
          })
        : null;
      hudEl.textContent = "";
      underWay = false;
      stopReceivingHud?.();
      stopReceivingHud = receiveEveryFrame(() => {
        const messages = loaded.scene.sceneManager.ui.messages();
        underWay = (messages.race?.lap ?? 1) > 0;
        const text = Object.entries(messages)
          .map(([channel, message]) => hudTexts[channel]?.(message))
          .filter(Boolean)
          .join("\n\n");
        if (hudEl.textContent !== text) {
          hudEl.textContent = text;
        }

        // A race's countdown shows while it runs, each second popping in,
        // once everyone is ready.
        const countdown =
          messages.race && !loaded.runner.isPaused() && snapshot?.started
            ? countdownText(messages.race)
            : "";
        if (countdownEl.textContent !== countdown) {
          countdownEl.textContent = countdown;
          countdownEl.classList.remove("tick");
          void countdownEl.offsetWidth;
          countdownEl.classList.add("tick");
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
        // Racing with friends, outside a room, asks which race to join
        // first, and Back from there goes back to the ships.
        confirm: async (pick) => {
          if (!pick.multiplayer) {
            return pick;
          }
          const race = await chooseRace(game, gameFile);
          return race && {...pick, race};
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

      // The race chosen to race with friends opens in its room, on its
      // track, which, joined by code, is the track the friend picked.
      if (picked.race) {
        const url = new URL(location.href);
        url.searchParams.set("room", picked.race.code);
        url.searchParams.set("scene", picked.race.scene);
        location.assign(url);
        return;
      }
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
    // it. When it stops playing once it is under way, its menu opens, if it
    // has one, and otherwise the page tells the player what to do, such as
    // to click to join a race. It tells them again when the game gets under
    // way, which its scene says only once it runs.
    const touchScreen = matchMedia("(pointer: coarse)").matches;
    // Whether the game plays, and whether it was paused with P, as the play
    // policy last said.
    let playingNow = false;
    let pausedNow = false;
    // In a room, before the race starts, the race's lobby shows instead,
    // while the player isn't playing: the race's code, for friends to join
    // it by, who they are waiting for, the others still racing the last
    // race, or how many are ready, and Start, to play and be ready, and
    // Leave race. Once they play, it tells them they are waiting, until
    // everyone is ready, and letting go of the game brings the lobby back.
    const tellPlayer = () => {
      const menuShows = !!(menu || menuLoading);
      const join = underWay ? "play" : "join race";
      // A player who came in once the race had started waits for the next.
      const spectating = !!snapshot?.started && !snapshot.you;
      const inLobby = roomName && (!snapshot?.started || spectating);
      const waitingFor = !inLobby
        ? ""
        : spectating
        ? "Waiting for the race to end"
        : `${snapshot?.lobby.ready ?? 0} of ${snapshot?.lobby.players ?? 1} ready`;
      const showLobby = inLobby && !menuShows && !playingNow;
      if (lobbyEl.hidden === showLobby) {
        lobbyEl.hidden = !showLobby;
      }
      const title = `Race ${roomName}`;
      if (showLobby && lobbyTitleEl.textContent !== title) {
        lobbyTitleEl.textContent = title;
      }
      if (showLobby && lobbyStatusEl.textContent !== waitingFor) {
        lobbyStatusEl.textContent = waitingFor;
      }
      const text =
        menuShows || showLobby
          ? ""
          : !playingNow
          ? `${manifest.name}\n${touchScreen ? "Tap" : "Click"} to ${join}`
          : pausedNow
          ? "Paused\nPress P to play"
          : inLobby
          ? `Waiting for players\n${waitingFor}`
          : "";
      if (messageEl.textContent !== text) {
        messageEl.textContent = text;
      }
      pauseEl.hidden = !touchScreen || menuShows || !playingNow;
    };
    const onPlayChange = (playsNow, pausedByP = false) => {
      if (playingNow && !playsNow && underWay) {
        openMenu();
      }
      playingNow = playsNow;
      pausedNow = pausedByP;
      tellPlayer();
    };
    const playPolicy = touchScreen
      ? new PlayOnTap(
          capture,
          () => stack.runners,
          ({paused}) => onPlayChange(!paused)
        )
      : new PlayWhileLocked(
          capture,
          () => stack.runners,
          ({locked, paused}) => onPlayChange(locked, paused)
        );
    // In a race, the server says how it is going, which its scene follows,
    // from its "room" input channel (see race.js), and whose ship is the
    // player's, every frame, and where the player's ship is on the server,
    // which the ship here goes by (see fly.js).
    receiveEveryFrame(() => {
      if (!remotePlayers) {
        return;
      }
      const {sceneManager} = playing.scene;
      sceneManager.input.publish("room", {
        type: "network",
        message: {race: snapshot?.race ?? null, you: snapshot?.you?.id ?? null},
      });
      // This runs just after the scene's frame, so how long ago the ship
      // here flew as the server's did is measured from it.
      if (answer) {
        const ago = (performance.now() - sentAtBySeq.get(answer.ack) - answer.ackAge) / 1000;
        const channel = sceneManager.getNodeStateByID(manifest.player)?.input ?? "player";
        sceneManager.input.publish(channel, {type: "network", message: {ship: answer.ship, ago}});
        answer = null;
      }
      tellPlayer();
    });

    // A race joins its room once it plays, the race's page's, or for a
    // player racing alone, a new one of their own, and tells the server 20
    // times a second what the player does: the ship they fly, whether they
    // play, rather than wait or pause, the keys their ship's script says
    // they hold, on its node's network channel (see fly.js), and the race
    // they want to race, numbered. What the server says about the race shows
    // in the scene: the other racers (see RemotePlayers), and to the
    // player's own ship, which flies here from their keys too, the server's
    // ship, and how long ago the ship here had flown from the same keys:
    // when the last message the server heard was sent, and then as long as
    // the server has flown since it heard it.
    if (remotePlayers) {
      const code = roomName ?? (await newRace(game, gameFile));
      const label = roomName ? `Race ${roomName}` : "Race";
      const room = new RoomConnection(code, {
        onChange: ({status, otherPlayerIDs, full}) => {
          roomStatusEl.textContent = full
            ? `${label} is full`
            : {
                [connecting]: `${label} · connecting…`,
                [connected]: `${label} · ${otherPlayerIDs.length + 1} playing`,
                [disconnected]: `${label} · disconnected`,
              }[status];
          // Racing alone, the room only shows when its connection is down.
          roomEl.hidden = !roomName && status === connected && !full;
          roomConnectEl.hidden = status !== disconnected;
        },
        onRace: (message) => {
          snapshot = message;
          remotePlayers?.show(message);
          if (message.you && sentAtBySeq.has(message.you.ack)) {
            answer = message.you;
          }
        },
      });
      domEvents.Subscription.create(roomConnectEl).on("click", () => room.connect());
      // The keys the player holds, as the ship's script last said them, and
      // as they were last sent, which are sent again at once when they
      // change, since the ship here flies from them at once.
      const keysHeld = () => {
        const {sceneManager} = playing.scene;
        const channel = sceneManager.getNodeStateByID(manifest.player)?.network;
        return sceneManager.network.latest(channel)?.keys ?? [];
      };
      let keysSent = [];
      const tellServer = () => {
        seq += 1;
        sentAtBySeq.set(seq, performance.now());
        sentAtBySeq.delete(seq - 100);
        keysSent = keysHeld();
        room.send({
          ship: shipID,
          ready: playingNow && !pausedNow,
          keys: keysSent,
          race: wantedRace,
          seq,
        });
      };
      setInterval(tellServer, 50);
      receiveEveryFrame(() => {
        if (keysHeld().join() !== keysSent.join()) {
          tellServer();
        }
      });
    }

    let wasUnderWay = null;
    receiveEveryFrame(() => {
      if (underWay !== wasUnderWay) {
        wasUnderWay = underWay;
        tellPlayer();
      }
    });

    // leaveRace goes back to choosing a ship in the hangar, or, in a game
    // without one, a track on its welcome page, by loading the page without
    // the one chosen in its URL. It leaves the race's room too, so that the
    // player chooses again whether to race alone or with friends, and which
    // race.
    const leaveRace = () => {
      const url = new URL(location.href);
      url.searchParams.delete(manifest.hangar ? "ship" : "scene");
      url.searchParams.delete("room");
      location.assign(url);
    };

    // replaceGame loads file, one of the game's scenes, in the game's place,
    // such as another track, or the same one again to restart it. A race
    // runs in a room on the server, which is the track's, so from or to a
    // race, the page loads the track afresh, in a room of its own.
    const replaceGame = async (file) => {
      if (remotePlayers || racedOnServer(file)) {
        const url = new URL(location.href);
        url.searchParams.set("scene", file);
        url.searchParams.delete("room");
        location.assign(url);
        return;
      }
      hideMenu();
      messageEl.textContent = "Loading…";
      const next = play(await loadGame(file), file);
      stack.replace(0, next.runner);
      playing.scene.dispose();
      playing = next;
      if (file !== gameFile) {
        gameFile = file;
        pushToURL("scene", file);
      }
    };

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
    // "menu" channel, and goes where a pick says. Its solo choices, such as
    // restarting the race, show only while the player plays alone.
    const openMenu = async () => {
      if (!manifest.menu || menu || menuLoading) {
        return;
      }
      capture.unlock();
      document.body.classList.add("menu-open");
      messageEl.textContent = "";
      menuLoading = load(manifest.menu, {paused: false});
      menu = await menuLoading;
      menuLoading = null;
      if (roomName) {
        setMenuChoices(menu.scene, (choices) => choices.filter(({solo}) => !solo));
      }
      menu.stopReceiving = receiveEveryFrame(async () => {
        const message = menu.scene.sceneManager.ui.latest("menu");
        if (!message || going) {
          return;
        }

        // Leaving the menu, or resuming the race, closes it and plays the
        // game.
        if (message.back || message.picked?.resume) {
          closeMenu();
          playPolicy.play();
          return;
        }

        // Restarting loads the game's scene again, and plays it. A race the
        // server runs asks it for the next race instead, which loads once
        // everyone racing asks for it.
        if (message.picked?.restart) {
          going = true;
          if (remotePlayers) {
            wantedRace = (snapshot?.number ?? 0) + 1;
          } else {
            await replaceGame(gameFile);
          }
          closeMenu();
          playPolicy.play();
          return;
        }

        if (message.picked?.leave) {
          going = true;
          leaveRace();
          return;
        }

        // A pick loads its scene in the game's place, unless it is the one
        // playing, and closes the menu.
        if (message.picked) {
          going = true;
          const file = message.picked.goTo;
          if (file !== gameFile) {
            await replaceGame(file);
          }
          closeMenu();
          return;
        }

        showMenu(message, new URL(manifest.menu, manifestURL));
      });
      stack.push(menu.runner);
      playPolicy.reset();
    };

    // The lobby's Start plays, the same as clicking the game, which makes
    // the player ready, and its Leave race leaves.
    domEvents.Subscription.create(lobbyEl).on("click", (evt) => {
      const choice = evt.target.closest("[data-lobby]")?.dataset.lobby;
      if (choice === "start") {
        playPolicy.play();
      } else if (choice === "leave") {
        leaveRace();
      }
    });

    // M opens the menu. The menu closes itself, when the player leaves it.
    capture.onInput((event) => {
      if (event.type === "keydown" && !event.repeat && !menu && event.code === "KeyM") {
        openMenu();
      }
    });

    // On a touch screen, which has no keys, the pause button pauses the
    // game, which opens the menu.
    domEvents.Subscription.create(pauseEl).on("click", () => playPolicy.pause());

    // Without a welcome scene to choose the track on, or a scene in the URL,
    // the game opens with its menu over it, to choose one.
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
