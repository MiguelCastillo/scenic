import {Lobby, racing, ready, waiting} from "./lobby.js";

describe("Lobby", () => {
  test("starts once everyone in the scene is ready", () => {
    const lobby = new Lobby();
    lobby.hear("p2", {scene: "race.json", status: waiting});
    expect(lobby.startsNow({scene: "race.json", status: ready})).toBe(false);
    lobby.hear("p2", {scene: "race.json", status: ready});
    expect(lobby.startsNow({scene: "race.json", status: ready})).toBe(true);
  });

  test("doesn't start until this player is ready too", () => {
    const lobby = new Lobby();
    lobby.hear("p2", {scene: "race.json", status: ready});
    expect(lobby.startsNow({scene: "race.json", status: waiting})).toBe(false);
  });

  test("starts at once for a player alone in the room", () => {
    const lobby = new Lobby();
    expect(lobby.startsNow({scene: "race.json", status: ready})).toBe(true);
  });

  test("waits for whoever is still racing the last race", () => {
    const lobby = new Lobby();
    lobby.hear("p2", {scene: "race.json", status: racing});
    expect(lobby.startsNow({scene: "race.json", status: ready})).toBe(false);
    expect(lobby.count({scene: "race.json", status: ready})).toEqual({
      players: 2,
      ready: 1,
      racing: 1,
    });
  });

  test("waits for players in the room it hasn't heard from yet", () => {
    const lobby = new Lobby();
    lobby.keep(["p2"]);
    expect(lobby.startsNow({scene: "race.json", status: ready})).toBe(false);
    expect(lobby.count({scene: "race.json", status: ready})).toEqual({
      players: 2,
      ready: 1,
      racing: 0,
    });
    lobby.hear("p2", {scene: "race.json", status: ready});
    expect(lobby.startsNow({scene: "race.json", status: ready})).toBe(true);
  });

  test("leaves out players in other scenes, and those who left", () => {
    const lobby = new Lobby();
    lobby.hear("p2", {scene: "highway.json", status: waiting});
    lobby.hear("p3", {scene: "race.json", status: waiting});
    lobby.keep(["p2"]);
    expect(lobby.startsNow({scene: "race.json", status: ready})).toBe(true);
  });

  test("makes the player who joined first the host", () => {
    const lobby = new Lobby();
    lobby.keep(["p3", "p12"]);
    expect(lobby.isHost("p2")).toBe(true);
    expect(lobby.isHost("p4")).toBe(false);
    lobby.keep(["p12"]);
    expect(lobby.isHost("p4")).toBe(true);
  });

  test("places players on the grid in the order they joined", () => {
    const lobby = new Lobby();
    lobby.hear("p10", {scene: "race.json", status: ready});
    lobby.hear("p2", {scene: "race.json", status: waiting});
    lobby.hear("p3", {scene: "race.json", status: racing});
    expect(lobby.place("p9", "race.json")).toBe(1);
    expect(lobby.place("p1", "race.json")).toBe(0);
  });
});
