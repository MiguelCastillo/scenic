module.exports = {
  src: ["loaders/file-formats.js"],
  dest: "dist/file-formats.js",
  umd: "fileformats",
  watch: false,
  minify: false,

  loaders: {
    cache: {
      dest: ".pakit/.fileformats-cache.json",
    },
  },
};
