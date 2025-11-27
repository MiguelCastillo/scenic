module.exports = {
  src: ["scene-main.js"],
  dest: "dist/scene.js",
  umd: "scene",
  watch: false,
  minify: false,
  eslint: false,

  loaders: {
    cache: {
      dest: ".pakit/.scene-cache.json",
    },
  },
};
