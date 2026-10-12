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
      name: "build-editor-scene",
      script: "npm",
      args: "run build:scene --workspace=apps/editor -- --watch",
      watch: ["apps/editor/.pakit-scene.js"],
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
      watch: ["apps/editor/.pakit-editor.js"],
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "build-editor-fileformats",
      script: "npm",
      args: "run build:fileformats --workspace=apps/editor -- --watch",
      watch: ["apps/editor/.pakit-fileformats.js"],
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
