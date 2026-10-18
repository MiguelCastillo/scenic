module.exports = {
  apps: [
    {
      // The server for the pages, the files they load and the rooms players
      // play together in (see server/src/main.js), restarted when its code
      // changes.
      name: "server",
      script: "node",
      args: "src/main.js --addr :3000 --static ..",
      cwd: "server",
      interpreter: "none",
      // Watched paths are relative to cwd.
      watch: ["src"],
      ignore_watch: ["src/*.test.js"],
    },
    {
      // Bundles the apps, and the web worker's file formats, from the
      // packages' source, again whenever anything they import changes (see
      // bin/build.js).
      name: "build",
      script: "bin/build.js",
      args: "--watch",
    },
    {
      // Gives the apps' bundles fingerprinted names, and writes their pages
      // to load them, whenever the build above builds them again (see
      // bin/fingerprint.js).
      name: "fingerprint",
      script: "bin/fingerprint.js",
      args: "--watch apps/arcade/dist/arcade.js apps/editor/dist/editor.js",
    },
    {
      // Gives each game a version, of everything it uses, again whenever
      // anything in games/ or resources/ changes, for players to tell
      // whether their files are the server's (see bin/version-games.js).
      name: "versions",
      script: "bin/version-games.js",
      args: "--watch",
    },
  ],
};
