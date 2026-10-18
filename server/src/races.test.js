import path from "node:path";

import {RaceRunner} from "./races.js";
import {startServer} from "./test-server.js";

describe("RaceRunner", () => {
  let server;
  let race;
  afterEach(async () => {
    race?.dispose();
    await server?.stop();
  });

  test("races NPCs in every seat to the finish, with the game's own scripts", async () => {
    server = await startServer({root: path.resolve(__dirname, "../..")});
    race = await RaceRunner.load(new URL("/games/bubble-squadron/", server.url), "race.json");
    const {sceneManager} = race;
    const raceState = () => sceneManager.getNodeStateByID("race").script.settings;

    // The player's ship is only what the racers are copies of.
    expect(sceneManager.getNodeByID("starfighter")).toBe(undefined);
    expect(raceState().entrants ?? []).toEqual([]);

    // Held at the start through the countdown, then off.
    const frame = 1000 / 60;
    let ms = 0;
    const stepUntil = (seconds) => {
      for (; ms <= seconds * 1000; ms += frame) {
        race.stepFrame(ms);
      }
    };
    stepUntil(1);
    const ship = "npc 1 starfighter";
    const start = sceneManager.getNodeStateByID(ship).transform.position;
    expect(raceState().entrants).toHaveLength(6);
    expect(sceneManager.getNodeStateByID(ship).held).toBe(true);
    stepUntil(8);
    expect(sceneManager.getNodeStateByID(ship).held).toBe(false);
    expect(sceneManager.getNodeStateByID(ship).transform.position).not.toEqual(start);

    // Every racer finishes both laps, within a few minutes of game time.
    while (ms < 300000 && Object.values(raceState().rivals).some((r) => r.finishedAt == null)) {
      race.stepFrame((ms += frame));
    }
    const finishTimes = Object.values(raceState().rivals).map((r) => r.finishedAt);
    expect(finishTimes).toHaveLength(6);
    finishTimes.forEach((time) => expect(time).toBeGreaterThan(0));
  });
});
