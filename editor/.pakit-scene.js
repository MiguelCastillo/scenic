module.exports = {
  src: ["editor/scene-main.js"],
  dest: "editor/dist/scene.js",
  umd: "scene",
  watch: true,

  loaders: {
    cache: {
      dest: ".pakit/.scene-cache.json",
    },
  },
};
