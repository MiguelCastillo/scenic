module.exports = {
  src: ["editor/loaders/file-formats.js"],
  dest: "editor/dist/file-formats.js",
  umd: "fileformats",
  watch: true,

  loaders: {
    cache: {
      dest: ".pakit/.fileformats-cache.json",
    },
  },
};
