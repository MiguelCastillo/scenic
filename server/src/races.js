import {addNPC, dealShips, gridPosition, Ships} from "@scenic/racers";
import {loadScene, SceneRunner} from "@scenic/runtime";

// How many frames a second a race runs at.
const framesPerSecond = 60;

// RaceRunner runs a race on the server: a game's scene, such as Bubble
// Squadron's race.json, with the game's own scripts, without anything to
// draw it (see loadScene in @scenic/runtime). Every racer is an entrant in
// the race, flown the same way, so the server decides where everyone is and
// how the race is going, and every player sees the same race.
//
// The scene's player node, such as the starfighter, is what every racer is
// a copy of, so it isn't in the race itself. For now, NPCs fill every seat
// the game's manifest has for the scene, "npcs": {racers, pilot, scenes}
// (see addNPC in @scenic/racers), from the first place on the grid, each in
// a ship of its own, dealt from the game's ships.
//
// Using it:
//
//   const race = await RaceRunner.load(new URL("/games/bubble-squadron/", serverURL), "race.json");
//   race.start();
//   ...
//   race.dispose();
//
// Its API: load(gameURL, sceneFile), start() and stop(), to run the race in
// real time, stepFrame(ms), to run it a frame at a time, such as in a test,
// sceneManager, the scene's, and dispose(), which stops it and tears it down.
export class RaceRunner {
  // load loads the race of sceneFile, such as "race.json", in the game at
  // gameURL, the full URL of its folder, where its game.json is, and fills
  // its seats. Its scripts load from there too, such as from the server
  // itself.
  static async load(gameURL, sceneFile) {
    const manifest = await fetchJSON(new URL("game.json", gameURL));
    const sceneURL = new URL(sceneFile, gameURL);
    const scene = await loadScene(null, await fetchJSON(sceneURL), {sceneURL: sceneURL.href});
    try {
      const ships = manifest.ships ? await Ships.load(new URL(manifest.ships, gameURL)) : null;
      const {npcs} = manifest;
      const seats = npcs?.scenes?.includes(sceneFile) ? npcs.racers : 0;
      const gridStart = scene.sceneManager.getNodeStateByID(manifest.player).transform;
      const dealt = dealShips(ships, null);
      await Promise.all(
        Array.from({length: seats}, (_, place) =>
          addNPC(scene, {
            playerNodeID: manifest.player,
            pilot: npcs.pilot,
            number: place + 1,
            position: gridPosition(gridStart, place),
            ship: dealt.length ? dealt[place % dealt.length] : null,
            ships,
            skill: seats > 1 ? 0.5 + (0.45 * place) / (seats - 1) : 0.7,
          })
        )
      );
      scene.remove(manifest.player);
    } catch (error) {
      scene.dispose();
      throw error;
    }
    return new RaceRunner(scene);
  }

  constructor(scene) {
    this.sceneManager = scene.sceneManager;
    this._scene = scene;
    this._runner = new SceneRunner(null, scene, {paused: false});
    this._timer = null;
  }

  // start runs the race in real time, framesPerSecond frames a second, until
  // stop.
  start() {
    const startedAt = performance.now();
    this._timer = setInterval(
      () => this._runner.stepFrame(performance.now() - startedAt),
      1000 / framesPerSecond
    );
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
