#!/usr/bin/env node

import {argv} from "process";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import fs from "fs";
import path from "path";
import {FbxFile, findChildByName, getNodeName} from "../src/formats/fbxfile.js";

let _indentCache = {};
function _indent(indent, char = "\t") {
  const k = indent + char;
  if (k in _indentCache === false) {
    _indentCache[k] = Array(indent).fill().join(char);
  }
  return _indentCache[k];
}

function getObjectsByID(model) {
  const nodeWrappersByID = {
    "0,0": {
      connections: [],
    },
  };

  const objects = findChildByName(model, "Objects");
  for (const node of objects.children) {
    nodeWrappersByID[node.attributes[0]] = {
      node,
      connections: [],
    };
  }

  return nodeWrappersByID;
}

(function main() {
  const args = yargs(hideBin(argv))
    .alias("f", "file")
    .coerce("f", path.resolve)
    .describe("f", "File to load.")
    .demandOption(["f"])
    .example("print.js -f foo.fbx").argv;

  const {file} = args;
  const modelBuffer = fs.readFileSync(file);
  const model = FbxFile.fromBinary(modelBuffer.buffer);
  const objectsByID = getObjectsByID(model);

  model.children.forEach((c) => printNode(c, 1));

  function printNode(node, indent = 1) {
    // eslint-disable-next-line no-console
    console.log(_indent(indent) + node.name + ": " + JSON.stringify(node.attributes) + " {");

    if (node.name === "Connections") {
      for (const props of node.properties) {
        switch (props.name) {
          case "C": {
            const [, src, dest] = props.value;
            const srcName = getNodeName(objectsByID[src].node);
            const destName = getNodeName(objectsByID[dest].node) || "root";
            const line = _indent(indent + 1) + `${props.name}: ${JSON.stringify(props.value)}`;

            const commentIndent = 60 - line.length;

            // eslint-disable-next-line no-console
            console.log(line, _indent(commentIndent, " ") + ` # ${srcName}, ${destName}`);
            break;
          }
          default: {
            // eslint-disable-next-line no-console
            console.log(_indent(indent + 1) + `${props.name}: ${JSON.stringify(props.value)}`);
            break;
          }
        }
      }
    } else {
      node.properties.forEach((p) => {
        let sizeInfo = Array.isArray(p.value) ? `*${p.value.length} ` : "";
        // eslint-disable-next-line no-console
        console.log(_indent(indent + 1) + `${p.name}: ${sizeInfo}${JSON.stringify(p.value)}`);
      });
    }

    node.children.forEach((c) => {
      printNode(c, indent + 1);
    });

    // eslint-disable-next-line no-console
    console.log(_indent(indent) + "}");
  }
})();
