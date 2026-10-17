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
      name: "build-runtime",
      script: "npm",
      args: "run build:runtime --workspace=packages/runtime -- --minify false --watch",
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "build-runtime-fileformats",
      script: "npm",
      args: "run build:fileformats --workspace=packages/runtime -- --minify false --watch",
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "build-editor-app",
      script: "npm",
      args: "run build:editor --workspace=apps/editor -- --watch",
      // The editor's bundle includes @scenic/runtime's, so it is rebuilt
      // whenever build-runtime rebuilds that.
      watch: ["apps/editor/.pakit-editor.js", "packages/runtime/dist/index.js"],
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "build-arcade",
      script: "npm",
      args: "run build:bundle --workspace=apps/arcade -- --minify false --watch",
      // The arcade's bundle includes @scenic/runtime's, so it is rebuilt
      // whenever build-runtime rebuilds that.
      watch: ["apps/arcade/.pakit-arcade.js", "packages/runtime/dist/index.js"],
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      // Gives the apps' bundles fingerprinted names, and writes their pages
      // to load them, whenever the builds above rebuild them (see
      // bin/fingerprint.js).
      name: "fingerprint",
      script: "bin/fingerprint.js",
      args: "--watch apps/arcade/dist/arcade.js apps/editor/dist/editor.js",
    },
  ],
};
