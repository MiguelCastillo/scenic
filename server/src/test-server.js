import WebSocket from "ws";

import {createServer} from "./server.js";

// startServer starts a scenic server for a test, on a free port, with
// createServer's options, and returns its HTTP URL, its WebSocket URL, and
// stop, which closes it and every player connected to it.
export async function startServer(options) {
  const server = createServer(options);
  const players = [];
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    wsURL: `${url.replace(/^http/, "ws")}/ws`,
    players,
    stop: async () => {
      players.forEach((player) => player.socket.terminate());
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

// join connects a player to room on the test server, and returns it with
// the first message to it, its welcome.
export async function join(testServer, room, {origin} = {}) {
  const socket = new WebSocket(`${testServer.wsURL}?room=${encodeURIComponent(room)}`, {origin});
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

  // nothing is whether no message comes to the player for a little while.
  async nothing() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return !this.messages.length;
  }

  // send sends message for the others in the room.
  send(message) {
    this.socket.send(JSON.stringify({type: "message", message}));
  }
}
