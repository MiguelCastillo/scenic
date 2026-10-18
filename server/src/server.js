import {readFileSync} from "node:fs";
import http from "node:http";
import path from "node:path";

import {newErrorID} from "./error-ids.js";
import {files} from "./files.js";
import {Relay} from "./relay.js";
import {RoomRace} from "./room-race.js";
import {rooms} from "./rooms.js";

// createServer makes the scenic server, an http.Server that serves
// everything the arcade and the editor need: their pages and the files they
// load from root, such as bundles, games and models, and the rooms players
// race in, at /ws (see Relay), which races are made and found in at /rooms/
// (see rooms), and whose races it runs (see RoomRace). Without a root, it
// only serves rooms, without races. The relay's options, originPatterns,
// maxPlayers, emptyRoomMs, startRace and versions, are Relay's. It returns
// {server, relay}, the relay to close when the server shuts down (see close
// in Relay).
export function createServer({root = null, ...relayOptions} = {}) {
  // A room's race loads its game from the server itself, which serves the
  // games, so there are races only with files to serve.
  const startRace = (game, scene) => {
    const {port} = server.address();
    return RoomRace.load(new URL(`/games/${game}/`, `http://127.0.0.1:${port}`), scene);
  };
  // The versions a player's page needs, to play game, each from its
  // version.json, or null without it: the arcade's, of the bundle its page
  // loads (see bin/fingerprint.js), and the game's, of everything it uses
  // (see bin/version-games.js), which the page knows too. They are read when
  // players join, since they change whenever the arcade is built again or a
  // game's files change.
  const versions = (game) => {
    const readVersion = (file) => {
      try {
        return JSON.parse(readFileSync(path.join(root, file), "utf8")).version;
      } catch {
        return null;
      }
    };
    return {
      arcade: readVersion("apps/arcade/version.json"),
      game: readVersion(`games/${game}/version.json`),
    };
  };
  const relay = new Relay({...(root && {startRace, versions}), ...relayOptions});
  const serveRooms = rooms(relay);
  const serveFiles = root ? files(root) : null;

  const server = http.createServer(async (request, response) => {
    const {pathname} = new URL(request.url, "http://localhost");
    try {
      if (pathname.startsWith("/rooms/")) {
        await serveRooms(request, response);
      } else if (serveFiles) {
        await serveFiles(request, response);
      } else {
        response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
        response.end("404 page not found\n");
      }
    } catch (error) {
      const errorID = newErrorID();
      console.error(`${errorID}: ${request.method} ${request.url}:`, error);
      if (!response.headersSent) {
        response.writeHead(500, {"Content-Type": "text/plain; charset=utf-8"});
      }
      response.end(`Something went wrong (${errorID})\n`);
    }
  });

  server.on("upgrade", (request, socket, head) => {
    if (new URL(request.url, "http://localhost").pathname === "/ws") {
      relay.handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });
  return {server, relay};
}
