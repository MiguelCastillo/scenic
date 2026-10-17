module.exports = {
  apps: [
    {
      // The server for the pages, the files they load and the rooms players
      // play together in (see server/main.go), restarted when its Go code
      // changes.
      name: "server",
      script: "go",
      args: "run . -addr :3000 -static ..",
      cwd: "server",
      interpreter: "none",
      // Watched paths are relative to cwd.
      watch: ["."],
      ignore_watch: ["*_test.go"],
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
  ],
};
