import react from "eslint-plugin-react";

export default [
  {ignores: ["**/dist/"]},
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      parserOptions: {ecmaFeatures: {jsx: true}},
    },
    rules: {
      curly: 2,
      "no-debugger": 2,
      "no-unused-vars": 1,
      quotes: [1, "double"],
      "eol-last": 2,
    },
  },
  // What runs in the browser.
  {
    files: ["packages/**", "apps/**"],
    rules: {
      "no-console": 2,
      "no-alert": 2,
      "wrap-iife": [2, "inside"],
    },
  },
  {
    files: ["apps/**/*.{js,jsx}"],
    ...react.configs.flat.recommended,
    settings: {react: {version: "detect"}},
  },
  {
    files: ["apps/**/*.{js,jsx}"],
    rules: {"react/prop-types": 0},
  },
];
