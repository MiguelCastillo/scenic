// Helpers for models' meta files that work for any model format (see "Model
// meta files" in the README). Each format has its own script, such as
// bin/generate-obj-meta.js for OBJ files, which measures models of that
// format and writes their meta files with writeMetaFile.

const crypto = require("crypto");
const fs = require("fs");

// metaFileOf returns the path of a model's meta file: the model's path with
// its extension replaced by ".meta.json", such as rock.meta.json for
// rock.obj.
function metaFileOf(model) {
  return model.replace(/\.[^./]+$/, "") + ".meta.json";
}

// readMeta returns the contents of a model's meta file, or {} when the model
// has no meta file.
function readMeta(model) {
  const file = metaFileOf(model);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

// hashOf returns the SHA-256 hash of the model file's bytes, as "sha256:"
// followed by hex digits. Any change to the file changes it, including
// changes that leave the geometry alone, such as an edited comment.
function hashOf(model) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(model)).digest("hex")}`;
}

// writeMetaFile writes a model's meta file, replacing any meta file already
// there. It writes, in order: the fields of meta, what the model's generator
// knows, such as its parameters and colliders; the fields of measured, what
// the format's script worked out from the model file, such as its bounds;
// and modelHash, the model file's hash, which checkMeta compares later.
// Numbers are rounded to 3 decimals, and each top-level field is on a line
// of its own.
function writeMetaFile(model, meta, measured) {
  const round = (_, v) => (typeof v === "number" ? Number(v.toFixed(3)) : v);
  const fields = Object.entries({...meta, ...measured, modelHash: hashOf(model)})
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value, round)}`);
  fs.writeFileSync(metaFileOf(model), `{\n${fields.join(",\n")}\n}\n`);
}

// checkMeta checks that each of models has an up-to-date meta file, meaning
// one whose modelHash matches the model file's hash. If any don't, it throws
// one error listing every problem, a line each, such as
// "resources/obj/cube.obj: no meta file". The problems are "no meta file",
// "its meta file has no modelHash" and "its modelHash doesn't match the model
// file".
function checkMeta(models) {
  const problems = [];
  for (const model of models) {
    if (!fs.existsSync(metaFileOf(model))) {
      problems.push(`${model}: no meta file`);
    } else if (!readMeta(model).modelHash) {
      problems.push(`${model}: its meta file has no modelHash`);
    } else if (readMeta(model).modelHash !== hashOf(model)) {
      problems.push(`${model}: its modelHash doesn't match the model file`);
    }
  }
  if (problems.length) {
    throw new Error(problems.join("\n"));
  }
}

module.exports = {checkMeta, metaFileOf, readMeta, writeMetaFile};
