import {addRacer, gridPosition, racerTemplate, removeRacer, Ships} from "@scenic/racers";
import {loadScene, SceneRunner} from "@scenic/runtime";

// How many frames a second a race runs at.
const framesPerSecond = 60;
// The id of a race's node in its scene, whose children are its gates (see
// race.js).
const course = "race";

// RaceRunner runs a race on the server: a game's scene, such as Bubble
// Squadron's race.json, with the game's own scripts, without anything to
// draw it (see loadScene in @scenic/runtime). Every racer is an entrant in
// the race, flown the same way, so the server decides where everyone is and
// how the race is going, and every player sees the same race.
//
// The scene's player node, such as the starfighter, is what every racer is
// a copy of (see racerTemplate in @scenic/racers), so it isn't in the race
// itself: racers are added to it, players' and NPCs', each at its place on
// the starting grid, and the race waits for them until waitForPlayers says
// they are ready (see race.js).
//
// Using it:
//
//   const race = await RaceRunner.load(new URL("/games/bubble-squadron/", serverURL), "race.json");
//   const npc = await race.addRacer({name: "npc 1", label: "Dart", place: 0, pilot: true});
//   race.waitForPlayers(false);
//   race.start();
//   ...
//   race.dispose();
//
// Its API: load(gameURL, sceneFile); addRacer, moveRacer and removeRacer;
// waitForPlayers(waiting); pause(paused); start() and stop(), to run the
// race in real time, and stepFrame(ms), to run it a frame at a time, such as
// in a test; frameAt, when its last frame ran; seats, the most racers in it; ships, the game's ships, or null;
// sceneManager, the scene's; race(), how the race is going; and dispose(),
// which stops it and tears it down.
export class RaceRunner {
  // load loads the race of sceneFile, such as "race.json", in the game at
  // gameURL, the full URL of its folder, where its game.json is. Its scripts
  // load from there too, such as from the server itself, and run on the
  // server, so the scene must be one of the races the game's manifest lists,
  // in "npcs": {scenes}.
  static async load(gameURL, sceneFile) {
    const manifest = await fetchJSON(new URL("game.json", gameURL));
    if (!manifest.npcs?.scenes?.includes(sceneFile)) {
      throw new Error(`"${sceneFile}" isn't one of the races of ${gameURL}`);
    }
    const sceneURL = new URL(sceneFile, gameURL);
    const scene = await loadScene(null, await fetchJSON(sceneURL), {sceneURL: sceneURL.href});
    try {
      const {sceneManager} = scene;
      const ships = manifest.ships ? await Ships.load(new URL(manifest.ships, gameURL)) : null;
      const racing = {
        template: racerTemplate(sceneManager, manifest.player),
        parentID: sceneManager.getNodeByID(manifest.player).parent.id,
        gridStart: sceneManager.getNodeStateByID(manifest.player).transform,
        pilot: manifest.npcs.pilot,
        seats: manifest.npcs.racers,
        ships,
      };
      scene.remove(manifest.player);
      return new RaceRunner(scene, racing);
    } catch (error) {
      scene.dispose();
      throw error;
    }
  }

  constructor(scene, {template, parentID, gridStart, pilot, seats, ships}) {
    this.sceneManager = scene.sceneManager;
    this.seats = seats;
    this.ships = ships;
    this._scene = scene;
    this._racing = {template, parentID, gridStart, pilot};
    this._runner = new SceneRunner(null, scene, {paused: false});
    this._timer = null;
    // When the last frame ran, in performance.now's time, while it runs in
    // real time.
    this.frameAt = 0;
    this.waitForPlayers(true);
  }

  // addRacer puts a racer in the race at place on the starting grid, from 0,
  // called name, such as "p2" or "npc 1", its input and network channel, and
  // label in the results, flying ship, the id of one of the game's ships, if
  // it has them, and flown by an NPC pilot of skill, from 0 to 1, if pilot,
  // and otherwise by the keys published on its channel. It resolves with
  // the racer, once it is in the race (see addRacer in @scenic/racers).
  addRacer({name, label, place, ship = null, pilot = false, skill = 0.7}) {
    const {template, parentID, gridStart} = this._racing;
    return addRacer(this._scene, {
      template,
      parentID,
      name,
      label,
      position: gridPosition(gridStart, place),
      ship,
      ships: this.ships,
      pilot: pilot ? this._racing.pilot : null,
      skill,
      course,
    });
  }

  // moveRacer moves racer to place on the starting grid, before the start.
  moveRacer(racer, place) {
    const state = this.sceneManager.getNodeStateByID(racer.shipNodeID);
    this.sceneManager.updateNodeStateByID(racer.shipNodeID, {
      transform: {...state.transform, position: gridPosition(this._racing.gridStart, place)},
    });
  }

  removeRacer(racer) {
    removeRacer(this._scene, racer, {course});
  }

  // waitForPlayers tells the race whether it is still waiting for its
  // players to be ready, which holds its countdown (see race.js).
  waitForPlayers(waiting) {
    const channel = this.sceneManager.getNodeStateByID(course).input;
    this.sceneManager.input.publish(channel, {
      type: "network",
      message: {waitingForPlayers: waiting},
    });
  }

  // race is how the race is going, as race.js has it in its settings: {laps,
  // waitingForPlayers, countdown, started, clock, racers, standings}.
  race() {
    const {laps, waitingForPlayers, countdown, started, clock, racers, standings} =
      this.sceneManager.getNodeStateByID(course).script.settings;
    return {laps, waitingForPlayers, countdown, started, clock, racers, standings};
  }

  // pause pauses the race, or resumes it: its clock and everything in it
  // stop while it is paused, as they do for a player playing alone who
  // pauses.
  pause(paused) {
    if (this._runner.isPaused() !== paused) {
      this._runner.togglePause();
    }
  }

  // start runs the race in real time, framesPerSecond frames a second, until
  // stop.
  start() {
    const startedAt = performance.now();
    this._timer = setInterval(() => {
      this.frameAt = performance.now();
      this._runner.stepFrame(this.frameAt - startedAt);
    }, 1000 / framesPerSecond);
  }

  stop() {
    clearInterval(this._timer);
  }

  // stepFrame moves the race a frame forward, to ms, the frame's time (see
  // stepFrame in SceneRunner).
  stepFrame(ms) {
    this._runner.stepFrame(ms);
  }

  dispose() {
    this.stop();
    this._scene.dispose();
  }
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`unable to load ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
