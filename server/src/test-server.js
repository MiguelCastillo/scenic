import WebSocket from "ws";

import {createServer} from "./server.js";

// startServer starts a scenic server for a test, on a free port, with
// createServer's options, and returns its HTTP URL, its WebSocket URL, its
// relay, and stop, which closes it and every player connected to it.
export async function startServer(options) {
  const {server, relay} = createServer(options);
  const players = [];
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    wsURL: `${url.replace(/^http/, "ws")}/ws`,
    relay,
    players,
    stop: async () => {
      players.forEach((player) => player.socket.terminate());
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    },
  };
}

// newRoom makes a room for a race of game's scene on the test server, and
// returns its code.
export async function newRoom(testServer, {game = "bubble-squadron", scene = "race.json"} = {}) {
  const response = await fetch(`${testServer.url}/rooms/new`, {
    method: "POST",
    body: JSON.stringify({game, scene}),
  });
  return (await response.json()).code;
}

// join connects a player to the room with code on the test server,
// expecting a race of game's scene in it, from a page of version, if given,
// and returns it with the first message to it, its welcome.
export async function join(
  testServer,
  code,
  {origin, game = "bubble-squadron", scene = "race.json", version = null} = {}
) {
  const query = new URLSearchParams({room: code, game, scene, ...(version && {version})});
  const socket = new WebSocket(`${testServer.wsURL}?${query}`, {origin});
  const player = new TestPlayer(socket);
  testServer.players.push(player);
  return {player, welcome: await player.next()};
}

// TestPlayer is a player connected to a test server, which reads the
// messages to it in order.
export class TestPlayer {
  constructor(socket) {
    this.socket = socket;
    this.messages = [];
    this.waiting = null;
    socket.on("message", (data) => {
      this.messages.push(JSON.parse(data));
      this.waiting?.();
    });
  }

  // next is the next message to the player, or fails after a second.
  async next() {
    const deadline = Date.now() + 1000;
    while (!this.messages.length) {
      if (Date.now() > deadline) {
        throw new Error("no message came");
      }
      await new Promise((resolve) => {
        this.waiting = resolve;
        setTimeout(resolve, 50);
      });
    }
    return this.messages.shift();
  }

  // nextWhere is the next message to the player that matches, skipping the
  // others, or fails after a few seconds.
  async nextWhere(matches) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const message = await this.next();
      if (matches(message)) {
        return message;
      }
    }
    throw new Error("no matching message came");
  }

  // nothing is whether no message comes to the player for a little while.
  async nothing() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return !this.messages.length;
  }

  // say tells the room's race what the player does (see hear in RoomRace).
  say(message) {
    this.socket.send(JSON.stringify({type: "player", ...message}));
  }
}
