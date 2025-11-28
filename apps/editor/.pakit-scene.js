module.exports = {
  src: ["scene-main.js"],
  dest: "dist/scene.js",

  // This causes exports in scene-main.js to be exported as window.scene
  // This is useful for the build/bundling process to make the exports
  // available to the global object (window in the browser)
  // See app-main.jsx for how this is used.
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
