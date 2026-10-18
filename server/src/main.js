// The scenic server serves everything the arcade and the editor need: their
// pages and the files they load, and the rooms players race in (see
// createServer).
//
//   node src/main.js --addr :3000 --static ..
//
// serves the repo's root from server/, with the arcade at
// /apps/arcade/index.html and the editor at /apps/editor/index.html.
//
// Flags:
// - --addr: the address to listen on, such as :3000 for every network
//   address, or localhost:3000. :3000 by default.
// - --static: a folder to serve files from, such as the repo's root; without
//   one, only rooms are served.
// - --origins: the hosts of the pages allowed to join rooms, comma
//   separated, such as localhost:*; * allows any, and is the default.
// - --max-players: the most players in a room, or 0 for no limit. 6 by
//   default.
import {parseArgs} from "node:util";

import {createServer} from "./server.js";

const {values: flags} = parseArgs({
  options: {
    addr: {type: "string", default: ":3000"},
    static: {type: "string", default: ""},
    origins: {type: "string", default: "*"},
    "max-players": {type: "string", default: "6"},
  },
});

const [, host, port] = flags.addr.match(/^(.*):(\d+)$/) ?? [];
if (!port) {
  console.error(`--addr must be host:port or :port, not ${flags.addr}`);
  process.exit(1);
}

const {server, relay} = createServer({
  root: flags.static || null,
  originPatterns: flags.origins.split(","),
  maxPlayers: Number(flags["max-players"]),
});
if (flags.static) {
  console.log(`serving files from ${flags.static}`);
}
server.listen(Number(port), host || undefined, () => console.log(`listening on ${flags.addr}`));

// Stopping the server, such as pm2 restarting it, or Ctrl-C, tells everyone
// racing that their race is over (see close in Relay) before it goes.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    console.log(`${signal}: shutting down`);
    relay.close();
    server.close();
    server.closeAllConnections();
    // It ends once every connection has closed, or soon after, so that
    // nothing still going, such as a race loading, holds it up, while
    // everyone hears that it is going.
    setTimeout(() => process.exit(0), 500).unref();
  });
}
