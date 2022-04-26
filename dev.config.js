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
      name: "build-scene",
      script: "npm",
      args: "run scene -- --watch",
      watch: ["editor/.pakit-scene.js"],
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "build-editor",
      script: "npm",
      args: "run editor -- --watch",
      watch: ["editor/.pakit-editor.js"],
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "build-fileformats",
      script: "npm",
      args: "run fileformats -- --watch",
      watch: ["editor/.pakit-fileformats.js"],
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
