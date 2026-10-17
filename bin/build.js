#!/usr/bin/env node
// build bundles what the browser loads, with esbuild:
// - each app, such as apps/arcade/dist/arcade.js, with everything it imports,
// - the file formats the resource loader's web worker reads models with,
//   packages/runtime/dist/file-formats.js, as the global `fileformats`.
//
//   bin/build.js [--watch] [--minify]
//
// Apps bundle the @scenic packages from their source (each package's "main"
// is its src), so a change to any package shows up in the next build of the
// apps, without building the package first. With --watch, it builds again
// whenever anything a bundle imports changes, and keeps running. The apps'
// pages load their bundles by fingerprinted names, which bin/fingerprint.js
// writes after each build.

const esbuild = require("esbuild");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const minify = args.includes("--minify");

// The browsers bundles are built for. Scenic needs WebGL2, so only browsers
// that have it can run it at all, and all of them run modern JavaScript as it
// is. Built for older browsers, every for...of loop and spread is turned into
// helpers that make new objects each time they run, which in code that runs
// every frame is a lot of garbage to collect. Safari 15 is the first with
// WebGL2 on.
const target = ["chrome100", "edge100", "firefox100", "safari15", "ios15"];

const bundles = [
  {entryPoints: ["apps/arcade/arcade-main.js"], outfile: "apps/arcade/dist/arcade.js"},
  {entryPoints: ["apps/editor/app-main.jsx"], outfile: "apps/editor/dist/editor.js"},
  {
    entryPoints: ["packages/runtime/src/loaders/file-formats.js"],
    outfile: "packages/runtime/dist/file-formats.js",
    globalName: "fileformats",
  },
];

async function build() {
  const contexts = await Promise.all(
    bundles.map((bundle) =>
      esbuild.context({
        ...bundle,
        bundle: true,
        format: "iife",
        target,
        minify,
        sourcemap: minify ? false : "inline",
        jsx: "transform",
        // React picks its development or production build by this.
        define: {"process.env.NODE_ENV": JSON.stringify(minify ? "production" : "development")},
        logLevel: "info",
      })
    )
  );

  if (watch) {
    await Promise.all(contexts.map((context) => context.watch()));
    return;
  }

  try {
    await Promise.all(contexts.map((context) => context.rebuild()));
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
}

build().catch(() => process.exit(1));
