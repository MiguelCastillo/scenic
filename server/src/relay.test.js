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

  test("relays messages to the others in the room", async () => {
    server = await startServer();
    const {player: a, welcome} = await join(server, "race");
    const {player: b} = await join(server, "race");
    const {player: c} = await join(server, "other race");
    await a.next(); // b joined

    a.send({position: [1, 2, 3]});

    expect(await b.next()).toEqual({
      type: "message",
      playerID: welcome.yourID,
      message: {position: [1, 2, 3]},
    });
    expect(await a.nothing()).toBe(true);
    expect(await c.nothing()).toBe(true);
  });

  test("says who sent a message whatever the sender claims", async () => {
    server = await startServer();
    const {player: a, welcome} = await join(server, "race");
    const {player: b} = await join(server, "race");
    await a.next(); // b joined

    a.socket.send(JSON.stringify({type: "message", playerID: "p99", message: {}}));

    expect((await b.next()).playerID).toBe(welcome.yourID);
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
