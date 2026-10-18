import WebSocket from "ws";

import {join, startServer} from "./test-server.js";

describe("Relay", () => {
  let server;
  afterEach(() => server?.stop());

  test("welcomes players with who is there", async () => {
    server = await startServer();
    const {welcome: first} = await join(server, "race");
    expect(first).toEqual({type: "welcome", yourID: expect.any(String), otherPlayerIDs: []});

    const {welcome: second} = await join(server, "race");
    expect(second).toEqual({
      type: "welcome",
      yourID: expect.any(String),
      otherPlayerIDs: [first.yourID],
    });
  });

  test("tells players who joins and leaves", async () => {
    server = await startServer();
    const {player: a} = await join(server, "race");
    const {player: b, welcome} = await join(server, "race");
    expect(await a.next()).toEqual({type: "joined", playerID: welcome.yourID});

    b.socket.close();
    expect(await a.next()).toEqual({type: "left", playerID: welcome.yourID});
  });

  test("gives a room's race its players, and what each one does, as from them", async () => {
    // A race that keeps what it is told, and answers each player who joins.
    const heard = [];
    const startRace = jest.fn(async (game, scene) => ({
      join: (playerID, send) => {
        heard.push(["join", playerID]);
        send({type: "race", game, scene});
      },
      hear: (playerID, message) => heard.push(["hear", playerID, message.ready]),
      leave: (playerID) => heard.push(["leave", playerID]),
      dispose: () => heard.push(["dispose"]),
    }));
    server = await startServer({startRace});
    const response = await fetch(`${server.url}/rooms/new`, {
      method: "POST",
      body: JSON.stringify({game: "bubble-squadron", scene: "race.json"}),
    });
    const {code} = await response.json();

    const {player: a, welcome} = await join(server, code);
    expect(await a.next()).toEqual({type: "race", game: "bubble-squadron", scene: "race.json"});
    a.socket.send(JSON.stringify({type: "player", playerID: "p99", ready: true}));
    await a.nothing();
    a.socket.close();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(startRace).toHaveBeenCalledTimes(1);
    expect(heard).toEqual([
      ["join", welcome.yourID],
      ["hear", welcome.yourID, true],
      ["leave", welcome.yourID],
      ["dispose"],
    ]);
  });

  test("refuses rooms without a name", async () => {
    server = await startServer();
    const status = await new Promise((resolve) => {
      const socket = new WebSocket(server.wsURL);
      socket.on("unexpected-response", (request, response) => resolve(response.statusCode));
      socket.on("open", () => resolve("open"));
    });
    expect(status).toBe(400);
  });

  test("origin patterns choose which pages can connect", async () => {
    const connects = async (originPatterns, origin) => {
      server = await startServer({originPatterns});
      const socket = new WebSocket(`${server.wsURL}?room=race`, {origin});
      const opened = await new Promise((resolve) => {
        socket.on("open", () => resolve(true));
        socket.on("error", () => resolve(false));
      });
      socket.terminate();
      await server.stop();
      server = null;
      return opened;
    };

    expect(await connects(["*"], "http://192.168.1.20:3000")).toBe(true);
    expect(await connects(["localhost:*"], "http://192.168.1.20:3000")).toBe(false);
    expect(await connects(["localhost:*"], "http://localhost:3000")).toBe(true);
  });
});
