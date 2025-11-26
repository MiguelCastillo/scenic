module.exports = {
  parser: "@babel/eslint-parser",
  parserOptions: {
    sourceType: "module",
  },
  env: {
    browser: true,
    commonjs: true,
  },
  extends: ["plugin:react/recommended"],
  rules: {
    curly: 2,
    "no-console": 2,
    "no-debugger": 2,
    "no-alert": 2,
    "no-use-before-define": 0,
    "no-underscore-dangle": 0,
    "no-multi-spaces": 0,
    "no-unused-vars": 1,
    semi: 0,
    "global-strict": 0,
    "wrap-iife": [2, "inside"],
    quotes: [1, "double"],
    "key-spacing": 0,
    "no-trailing-spaces": 0,
    "eol-last": 2,
    "react/prop-types": 0,
  },
  settings: {
    // This has react because this configuration is also used by the scene
    // editor which is a react app.
    // TODO(miguel): add new eslint file in the scene editor
    react: {
      version: "detect",
    },
  },
};
