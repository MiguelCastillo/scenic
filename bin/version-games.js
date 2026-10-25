#!/usr/bin/env node
// version-games gives each game in games/ a version: a hash of everything
// the game uses, so that two players with the same version have the same
// files, and a player whose files changed since they loaded the game can
// tell (see version in server/src/relay.js). It writes it to the game's
// version.json, as {"version": "3f9a2c41d0", "resources": [...]}, with the
// files of resources/ it covers.
//
//   bin/version-games.js [--watch]
//
// What a game uses is everything in its own folder, such as
// games/bubble-squadron/, and the files in resources/, which games share,
// that it uses, and only those, so that changing a shared file for one game
// gives the others no new version. They are found by following what names
// them (see referencesIn): a game's scenes and scripts name shared files by
// their paths, such as "/resources/obj/flame.obj", and those can name
// others, such as a model's materials. A kind of file that names others in
// a way this doesn't follow, such as textures inside an fbx model, would be
// missed: the server logs any file a game's page loads that isn't in its
// version (see files.js in server/src).
//
// A file of up to maxHashedBytes counts by what is in it, and a bigger one,
// such as a model, by its size and when it last changed, so that working the
// versions out is quick however big resources/ grows.
//
// With --watch, it works them out again whenever anything in games/ or
// resources/ changes, and keeps running.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// How many hex digits of the hash a version has.
const hashLength = 10;
// The biggest file counted by what is in it, in bytes.
const maxHashedBytes = 1024 * 1024;

const root = path.resolve(__dirname, "..");
const gamesDir = path.join(root, "games");
const resourcesDir = path.join(root, "resources");
const watch = process.argv.includes("--watch");

// filesIn is every file under dir, as paths relative to root, in order, other
// than games' version.json files, which these versions are written to, and
// files in a screenshots folder, which are for the README, not the game.
function filesIn(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, {recursive: true, withFileTypes: true})
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name !== "version.json" &&
        path.basename(entry.parentPath ?? entry.path) !== "screenshots"
    )
    .map((entry) => path.relative(root, path.join(entry.parentPath ?? entry.path, entry.name)))
    .sort();
}

// addFiles adds files to hash: each one's path, and what is in it, or its
// size and when it last changed, for a big one.
function addFiles(hash, files) {
  for (const file of files) {
    const full = path.join(root, file);
    const {size, mtimeMs} = fs.statSync(full);
    hash.update(`${file}\0`);
    hash.update(size <= maxHashedBytes ? fs.readFileSync(full) : `${size} ${mtimeMs}`);
    hash.update("\0");
  }
}

// referencesIn is the files that file names, as paths relative to root, of
// those that exist: in a scene, a ship or any other JSON, and in a script,
// the paths of shared files, such as "/resources/obj/flame.obj"; in an OBJ
// model, its materials, by its mtllib lines; and in a materials file, its
// textures, by its map_ lines, both relative to the file naming them. An OBJ
// or FBX model also uses its meta file, such as rock.meta.json for rock.obj,
// when there is one. No file names a meta file, since loaders find it from
// the model's name, so it is added here (see "Model meta files" in the
// README).
function referencesIn(file) {
  const full = path.join(root, file);
  const ext = path.extname(file).toLowerCase();
  const named = [];
  if (ext === ".json" || ext === ".js") {
    const text = fs.readFileSync(full, "utf8");
    for (const [match] of text.matchAll(/\/resources\/[^"'`\s)]+/g)) {
      named.push(path.join(root, match));
    }
  } else if (ext === ".obj" || ext === ".mtl") {
    const text = fs.readFileSync(full, "utf8");
    const pattern =
      ext === ".obj" ? /^\s*mtllib\s+(.+?)\s*$/gm : /^\s*map_\w+\s+(?:.*\s)?(\S+)\s*$/gm;
    for (const [, name] of text.matchAll(pattern)) {
      named.push(path.resolve(path.dirname(full), name));
    }
  }
  if (ext === ".obj" || ext === ".fbx") {
    named.push(full.slice(0, -ext.length) + ".meta.json");
  }
  return named
    .filter((name) => fs.existsSync(name) && fs.statSync(name).isFile())
    .map((name) => path.relative(root, name));
}

// usedResources is the files of resources/ that files use: those they name,
// and those that those name, and so on, in order.
function usedResources(files) {
  const used = new Set();
  const toVisit = [...files];
  while (toVisit.length) {
    for (const named of referencesIn(toVisit.pop())) {
      if (named.startsWith(`resources${path.sep}`) && !used.has(named)) {
        used.add(named);
        toVisit.push(named);
      }
    }
  }
  return [...used].sort();
}

// versionGames writes every game's version.json, where it changed.
function versionGames() {
  const games = fs
    .readdirSync(gamesDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((game) => fs.existsSync(path.join(gamesDir, game, "game.json")));
  for (const game of games) {
    const own = filesIn(path.join(gamesDir, game));
    const resources = usedResources(own);
    const hash = crypto.createHash("sha256");
    addFiles(hash, own);
    addFiles(hash, resources);
    const version = hash.digest("hex").slice(0, hashLength);
    const file = path.join(gamesDir, game, "version.json");
    const json = `${JSON.stringify({version, resources}, null, 2)}\n`;
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== json) {
      fs.writeFileSync(file, json);
      console.log(`version-games: ${game} is ${version}, with ${resources.length} shared files`);
    }
  }
}

versionGames();

if (watch) {
  // The versions are worked out again a moment after the last change, so
  // that changing many files at once, such as switching branches, works
  // them out once.
  let timer = null;
  const later = (event, file) => {
    if (file && path.basename(file) === "version.json") {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(versionGames, 200);
  };
  fs.watch(gamesDir, {recursive: true}, later);
  fs.watch(resourcesDir, {recursive: true}, later);
  console.log("version-games: watching games/ and resources/");
}
