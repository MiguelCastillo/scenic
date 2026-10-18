import {join, startServer} from "./test-server.js";

// An error id, as the server makes them (see newErrorID).
const errorID = expect.stringMatching(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);

// postRace asks the test server for a room for a race, at /rooms/new or
// /rooms/auto, and returns its code.
async function postRace(server, kind, game, scene) {
  const response = await fetch(`${server.url}/rooms/${kind}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({game, scene}),
  });
  return (await response.json()).code;
}

// getRoom is what the test server says about the room with code, and its
// status.
async function getRoom(server, code) {
  const response = await fetch(`${server.url}/rooms/${code}`);
  return {status: response.status, info: response.ok ? await response.json() : null};
}

describe("rooms", () => {
  let server;
  afterEach(() => server?.stop());

  test("starts a new race with a code", async () => {
    server = await startServer();
    const code = await postRace(server, "new", "bubble-squadron", "race.json");
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);

    expect(await getRoom(server, code.toLowerCase())).toEqual({
      status: 200,
      info: {
        code,
        game: "bubble-squadron",
        scene: "race.json",
        players: 0,
        full: false,
        underway: false,
      },
    });

    await join(server, code);
    expect((await getRoom(server, code)).info.players).toBe(1);
  });

  test("says there is no race for an unknown code", async () => {
    server = await startServer();
    expect((await getRoom(server, "ZZZZ")).status).toBe(404);
  });

  test("auto join shares a room on the same track", async () => {
    server = await startServer({maxPlayers: 2});
    const first = await postRace(server, "auto", "bubble-squadron", "race.json");
    await join(server, first);

    expect(await postRace(server, "auto", "bubble-squadron", "race.json")).toBe(first);
    expect(await postRace(server, "auto", "bubble-squadron", "highway.json")).not.toBe(first);
    expect(await postRace(server, "new", "bubble-squadron", "race.json")).not.toBe(first);

    await join(server, first);
    expect(await postRace(server, "auto", "bubble-squadron", "race.json")).not.toBe(first);
  });

  test("auto join skips races that have started, which joining by code watches", async () => {
    // A race that has started once someone is ready.
    let race = null;
    const startRace = async () =>
      (race = {
        underway: false,
        join: () => {},
        hear: () => (race.underway = true),
        leave: () => {},
        dispose: () => {},
      });
    server = await startServer({startRace});
    const started = await postRace(server, "auto", "bubble-squadron", "race.json");
    const {player} = await join(server, started);
    player.say({ready: true});
    await player.nothing();

    expect((await getRoom(server, started)).info.underway).toBe(true);
    expect(await postRace(server, "auto", "bubble-squadron", "race.json")).not.toBe(started);
    expect((await join(server, started)).welcome.type).toBe("welcome");
  });

  test("auto join skips races started with a code", async () => {
    server = await startServer();
    const started = await postRace(server, "new", "bubble-squadron", "race.json");
    await join(server, started);
    expect(await postRace(server, "auto", "bubble-squadron", "race.json")).not.toBe(started);
  });

  test("turns away players from a full room", async () => {
    server = await startServer({maxPlayers: 1});
    const code = await postRace(server, "new", "bubble-squadron", "race.json");
    await join(server, code);
    expect((await getRoom(server, code)).info.full).toBe(true);

    const {welcome} = await join(server, code);
    expect(welcome).toEqual({type: "full", errorID, serverStartedAt: expect.any(Number)});
  });

  test("keeps an empty room for its players to come back", async () => {
    server = await startServer();
    const code = await postRace(server, "new", "bubble-squadron", "race.json");
    const {player} = await join(server, code);
    player.socket.terminate();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect((await getRoom(server, code)).status).toBe(200);
  });

  test("forgets a room empty for long", async () => {
    server = await startServer({emptyRoomMs: -1});
    const code = await postRace(server, "new", "bubble-squadron", "race.json");
    expect((await getRoom(server, code)).status).toBe(404);
  });

  test("needs a game and a scene", async () => {
    server = await startServer();
    const response = await fetch(`${server.url}/rooms/new`, {method: "POST", body: "{}"});
    expect(response.status).toBe(400);
  });
});
