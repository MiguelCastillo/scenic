#!/usr/bin/env node

import {argv} from "process";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import fs from "fs";
import path from "path";
import {FbxFile} from "../src/formats/fbxfile.js";

let _indentCache = {};
function _indent(indent) {
  if (indent in _indentCache === false) {
    _indentCache[indent] = Array(indent).fill().join("\t");
  }
  return _indentCache[indent];
}

function printNode(node, indent=1) {
  console.log(_indent(indent) + node.name + ": " + JSON.stringify(node.attributes) + " {");

  node.properties.forEach(p => {
    console.log(_indent(indent+1) + p.name + ": " + JSON.stringify(p.value))
  });

  node.children.forEach(c => {
    printNode(c, indent+1);
  });

  console.log(_indent(indent) + "}")
}

(function main() {
  const args = yargs(hideBin(argv))
    .alias("f", "file")
    .coerce("f", path.resolve)
    .describe("f", "File to load.")
    .demandOption(["f"])
    .example("print.js -f foo.fbx")
    .argv;

  const {file} = args;
  const modelBuffer = fs.readFileSync(file);
  const model = FbxFile.fromBinary(modelBuffer.buffer);
  model.children.forEach(c => printNode(c, 1))
})();
