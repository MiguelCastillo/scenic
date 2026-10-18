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

  test("races its racers to the finish, with the game's own scripts", async () => {
    server = await startServer({root: path.resolve(__dirname, "../..")});
    race = await RaceRunner.load(new URL("/games/bubble-squadron/", server.url), "race.json");
    const {sceneManager} = race;

    // The player's ship is only what the racers are copies of.
    expect(sceneManager.getNodeByID("starfighter")).toBe(undefined);
    expect(race.seats).toBe(6);
    for (let place = 0; place < race.seats; place++) {
      await race.addRacer({
        name: `npc ${place + 1}`,
        label: `NPC ${place + 1}`,
        place,
        pilot: true,
      });
    }
    expect(sceneManager.getNodeStateByID("race").script.settings.entrants).toHaveLength(6);

    // Held at the start until the race stops waiting for its players and
    // counts down, then off.
    const frame = 1000 / 60;
    let ms = 0;
    const stepUntil = (seconds) => {
      for (; ms <= seconds * 1000; ms += frame) {
        race.stepFrame(ms);
      }
    };
    const ship = "npc 1 starfighter";
    const start = sceneManager.getNodeStateByID(ship).transform.position;
    stepUntil(10);
    expect(race.race()).toMatchObject({started: false, countdown: 5});
    expect(sceneManager.getNodeStateByID(ship).held).toBe(true);
    race.waitForPlayers(false);
    stepUntil(16);
    expect(race.race().started).toBe(true);
    expect(sceneManager.getNodeStateByID(ship).held).toBe(false);
    expect(sceneManager.getNodeStateByID(ship).transform.position).not.toEqual(start);

    // Every racer finishes both laps, within a few minutes of game time, and
    // the standings put them in order.
    const finishTimes = () => Object.values(race.race().racers).map((r) => r.finishedAt);
    while (ms < 300000 && finishTimes().some((time) => time == null)) {
      race.stepFrame((ms += frame));
    }
    expect(finishTimes()).toHaveLength(6);
    finishTimes().forEach((time) => expect(time).toBeGreaterThan(0));
    const standings = race.race().standings.map(({finishedAt}) => finishedAt);
    expect(standings).toEqual([...standings].sort((a, b) => a - b));
  });

  test("runs only the races the game lists", async () => {
    server = await startServer({root: path.resolve(__dirname, "../..")});
    await expect(
      RaceRunner.load(new URL("/games/bubble-squadron/", server.url), "hangar.json")
    ).rejects.toThrow("isn't one of the races");
  });
});
