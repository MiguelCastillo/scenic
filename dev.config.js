module.exports = {
  apps: [
    {
      name: "server",
      script: "npx",
      args: "3dub --config .3dub.js",
      watch: [".3dub.js"],
      ignore_watch: ["node_modules"],
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
      args: "run build --workspace=apps/arcade -- --watch",
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
  ],
};
