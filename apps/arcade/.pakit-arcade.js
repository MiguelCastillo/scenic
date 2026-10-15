module.exports = {
  src: ["arcade-main.js"],
  dest: "dist/arcade.js",
  watch: false,
  minify: false,
  eslint: false,

  loaders: {
    cache: {
      dest: ".pakit/.arcade-cache.json",
    },
  },
};
