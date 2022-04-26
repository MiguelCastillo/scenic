module.exports = {
  src: ["editor/app-main.jsx"],
  dest: "editor/dist/editor.js",
  watch: true,

  loaders: {
    cache: {
      dest: ".pakit/.editor-cache.json",
    },
  },
};
