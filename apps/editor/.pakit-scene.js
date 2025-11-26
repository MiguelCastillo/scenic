module.exports = {
  src: ["scene-main.js"],
  dest: "dist/scene.js",
  umd: "scene",
  watch: false,
  minify: false,

  loaders: {
    cache: {
      dest: ".pakit/.scene-cache.json",
    },
  },
};
