import {treeGetMatches} from "../src/scene-manager.js";
import {isLight, isStaticMesh} from "./scene-factory.js";
import {ShaderProgram} from "../src/shaders/program.js";

const shaderCache = {};

export function createShaderProgramLoader(gl, sceneManager) {
  function load(node) {
    if (isStaticMesh(node)) {
      sceneManager.getNodeByName(node.name).withShaderProgram(shaderCache["phong-lighting"]);
    } else if (isLight(node)) {
      sceneManager.getNodeByName(node.name).withShaderProgram(shaderCache["flat-material"]);
    } else {
      throw new Error("Unable to intialize shader program because node is not a static-mesh or light");
    }
  }

  function loadMany(nodes) {
    return cacheShaders(gl, [
      "phong-lighting",
      "flat-material",
    ]).then(() => {
      nodes.forEach(n => load(n));
    });
  }

  return {
    loadMany,
  }
}

export function getNodesWithShadersFromConfig(config) {
  const traverse = treeGetMatches((item) => (
    isLight(item) || isStaticMesh(item)
  ));

  return traverse(config.items);
}

function cacheShaders(gl, names) {
  const pendingShaders = names
    .filter(shaderName => !shaderCache[shaderName])
    .map(shaderName => {
      // File extensions for shaders aren't quite standard, however I have
      // chosen what is used here:
      // https://www.khronos.org/opengles/sdk/tools/Reference-Compiler/
      const vertexShaderPath = "/editor/shaders/" + shaderName + ".vert";
      const fragmentShaderPath = "/editor/shaders/" + shaderName + ".frag";

      return Promise.all([
        fetch(vertexShaderPath).then(resp => resp.text()),
        fetch(fragmentShaderPath).then(resp => resp.text()),
      ])
      .then(([vert, frag]) => {
        // tester for regex to parse out attributes.
        // https://regex101.com/r/jmad0Z/1
        const vertAttributes = [
          ...vert.matchAll(/\s*in\s+(\w+)\s+(\w+);/g)
        ].map(([,/*type*/,name]) => {
          return {
            name,
          };
        });

        // TODO(miguel): automatically add attributes during program linking
        shaderCache[shaderName] = new ShaderProgram(gl)
          .link(vert, frag)
          .addAttributes(vertAttributes);
      });
    });

  return Promise.all(pendingShaders);
}
