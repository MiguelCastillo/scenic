#!/usr/bin/env node
// fingerprint gives an app's bundle a name with a hash of what is in it, such
// as dist/arcade.3f9a2c41d0.js, and writes the app's page to load it, so that
// browsers can keep a bundle for good: a bundle that changes gets a new name,
// and the page, which browsers never keep (see server/src/files.js), always names
// the latest.
//
//   bin/fingerprint.js [--watch] apps/arcade/dist/arcade.js [...]
//
// For each bundle, such as apps/arcade/dist/arcade.js, built by bin/build.js,
// it:
// - copies the bundle to its fingerprinted name, next to it,
// - deletes the bundle's older fingerprinted copies,
// - writes the app's index.html, from its index.template.html, two folders
//   up from the bundle, with every reference to the bundle, such as
//   "dist/arcade.js", naming the fingerprinted copy instead,
// - writes the app's version.json, beside it, as {"version": "3f9a2c41d0"},
//   the hash, for the server to tell whether a player's page is the one it
//   serves (see server/src/server.js), and for the app's shaders to be asked
//   for at (see setShadersVersion in @scenic/runtime).
//
// The hash is of the bundle and the runtime's shaders, which the runtime
// loads separately, so that a changed shader gives the app a new version.
//
// With --watch, it does it again whenever a bundle or a template changes,
// such as when bin/build.js builds a bundle again in its watch mode, and keeps
// running.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// How many hex digits of the bundle's hash go in its name.
const hashLength = 10;
// The runtime's shaders, which every app's version covers.
const shadersDir = path.resolve(__dirname, "../packages/runtime/shaders");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const bundles = args.filter((arg) => arg !== "--watch").map((bundle) => path.resolve(bundle));

if (!bundles.length) {
  console.error("usage: bin/fingerprint.js [--watch] apps/arcade/dist/arcade.js [...]");
  process.exit(1);
}

// fingerprint fingerprints bundle, and writes its app's page to load it. It
// does nothing if the bundle hasn't been built yet.
function fingerprint(bundle) {
  if (!fs.existsSync(bundle)) {
    console.warn(`fingerprint: ${bundle} isn't built yet`);
    return;
  }
  const dir = path.dirname(bundle);
  const {name, ext} = path.parse(bundle);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(bundle));
  for (const shader of fs.readdirSync(shadersDir).sort()) {
    hash.update(`\0${shader}\0`).update(fs.readFileSync(path.join(shadersDir, shader)));
  }
  const version = hash.digest("hex").slice(0, hashLength);
  const fingerprinted = `${name}.${version}${ext}`;

  fs.copyFileSync(bundle, path.join(dir, fingerprinted));
  const older = new RegExp(`^${name}\\.[0-9a-f]{${hashLength}}\\${ext}$`);
  fs.readdirSync(dir)
    .filter((file) => older.test(file) && file !== fingerprinted)
    .forEach((file) => fs.unlinkSync(path.join(dir, file)));

  const appDir = path.dirname(dir);
  const template = path.join(appDir, "index.template.html");
  const page = path.join(appDir, "index.html");
  const reference = `${path.basename(dir)}/${name}${ext}`;
  const html = fs
    .readFileSync(template, "utf8")
    .split(reference)
    .join(`${path.basename(dir)}/${fingerprinted}`);
  if (!fs.existsSync(page) || fs.readFileSync(page, "utf8") !== html) {
    fs.writeFileSync(page, html);
    console.log(`fingerprint: ${path.relative(process.cwd(), page)} loads ${fingerprinted}`);
  }
  const versionFile = path.join(appDir, "version.json");
  const json = `${JSON.stringify({version})}\n`;
  if (!fs.existsSync(versionFile) || fs.readFileSync(versionFile, "utf8") !== json) {
    fs.writeFileSync(versionFile, json);
  }
}

bundles.forEach(fingerprint);

if (watch) {
  // A bundle is fingerprinted again a moment after it, its template or a
  // shader last changed, so that a build that writes the bundle in pieces is
  // fingerprinted once, when it is done.
  const timersByBundle = new Map();
  const later = (bundle) => {
    clearTimeout(timersByBundle.get(bundle));
    timersByBundle.set(
      bundle,
      setTimeout(() => fingerprint(bundle), 200)
    );
  };

  bundles.forEach((bundle) => {
    const dir = path.dirname(bundle);
    const appDir = path.dirname(dir);
    fs.mkdirSync(dir, {recursive: true});
    fs.watch(dir, (event, file) => {
      if (file === path.basename(bundle)) {
        later(bundle);
      }
    });
    fs.watch(appDir, (event, file) => {
      if (file === "index.template.html") {
        later(bundle);
      }
    });
  });
  fs.watch(shadersDir, () => bundles.forEach(later));
  console.log(
    `fingerprint: watching ${bundles.map((b) => path.relative(process.cwd(), b)).join(", ")}`
  );
}
