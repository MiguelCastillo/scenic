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

// checkMeta returns null when a model's meta file is up to date, meaning its
// modelHash matches the model file's hash now. Otherwise it returns what is
// wrong, as a sentence: "no meta file", "its meta file has no modelHash" or
// "the model changed since its meta file was written".
function checkMeta(model) {
  if (!fs.existsSync(metaFileOf(model))) {
    return "no meta file";
  }
  const {modelHash} = readMeta(model);
  if (!modelHash) {
    return "its meta file has no modelHash";
  }
  return modelHash === hashOf(model) ? null : "the model changed since its meta file was written";
}

module.exports = {checkMeta, metaFileOf, readMeta, writeMetaFile};
