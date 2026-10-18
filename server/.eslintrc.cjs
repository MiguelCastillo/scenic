module.exports = {
  root: true,
  parser: "@babel/eslint-parser",
  parserOptions: {
    sourceType: "module",
    // Babel's config is the project's, at the root (babel.config.json).
    babelOptions: {rootMode: "upward"},
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ["dist/"],
  rules: {
    curly: 2,
    "no-debugger": 2,
    "no-unused-vars": 1,
    quotes: [1, "double"],
    "eol-last": 2,
  },
};
