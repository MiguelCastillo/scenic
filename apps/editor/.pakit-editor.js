module.exports = {
  src: ["app-main.jsx"],
  dest: "dist/editor.js",
  watch: false,
  minify: false,

  loaders: {
    cache: {
      dest: ".pakit/.editor-cache.json",
    },
  },
};
