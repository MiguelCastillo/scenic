module.exports = {
  src: ["editor/app-main.jsx"],
  dest: "editor/dist/editor.js",
  watch: false,
  minify: false,

  loaders: {
    cache: {
      dest: ".pakit/.editor-cache.json",
    },
  },
};
