import {treeGetMatches} from "../src/scene/traversal.js";
import {isLight, isStaticMesh} from "./scene-factory.js";
import {
  ShaderProgram,
  compileShaderSource,
} from "../src/shaders/program.js";

const shaderCache = {};

export function createShaderProgramLoader(gl, sceneManager) {
  function load(node) {
    // TODO(miguel): remove this magic of matching shaders to node types and
    // instead define these in the scene config for each model. This approach
    // was useful to get started, but as I build out support for custom scene
    // node types, this won't scale as we have in the case of FBX file
    // support where I use a different shader to support textures.
    if (isStaticMesh(node)) {
      sceneManager.getNodeByName(node.name).withShaderProgram(createShaderProgram(gl, "phong-lighting"));
    } else if (isLight(node)) {
      sceneManager.getNodeByName(node.name).withShaderProgram(createShaderProgram(gl, "flat-material"));
    } else {
      throw new Error("Unable to intialize shader program because node is not a static-mesh or light");
    }
  }

  function loadMany(nodes) {
    return cacheShaders([
      "phong-lighting",
      "phong-texture",
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

function cacheShaders(names) {
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
      .then(([vertexShaderSource, fragmentShaderSource]) => {
        // tester for regex to parse out attributes.
        // https://regex101.com/r/jmad0Z/1
        const vertAttributes = [
          ...vertexShaderSource.matchAll(/\s*in\s+(\w+)\s+(\w+);/g)
        ].map(([,type,name]) => {
          let size = 3;
          switch (type) {
            case "vec2":
              size = 2;
              break;
            case "vec3":
              size = 3;
              break;
            case "vec4":
              // TODO(miguel): bad bad bad.  I took the quick shortcut
              // to make everything size 3 in the attributes for the
              // shader program. That's because until now everything had
              // been 3D vertex data. But now we have texture coordinates
              // which are 2D (uv) coordinates, so that shortcut breaks
              // that. To make this better, the vector sizes should match
              // the component count in the buffers.
              size = 3;
              break;
          }

          return {
            name,
            size,
          };
        });


        // TODO(miguel): automatically add attributes during program linking
        shaderCache[shaderName] = {
          vertAttributes,
          vertexShaderSource,
          fragmentShaderSource,
        };

        return shaderCache[shaderName];
      });
    });

  return Promise.all(pendingShaders);
}

export function createShaderProgram(gl, name) {
  if (!shaderCache[name]) {
    throw new Error(`shader program ${name} is not loaded`);
  }

  let {
    vertexShader,
    fragmentShader,
    vertexShaderSource,
    fragmentShaderSource,
    vertAttributes,
  } = shaderCache[name];

  if (!vertexShader) {
    vertexShader = shaderCache[name].vertexShader = compileShaderSource(
      gl, gl.VERTEX_SHADER, vertexShaderSource,
    )
  }

  if (!fragmentShader) {
    fragmentShader = shaderCache[name].fragmentShader = compileShaderSource(
      gl, gl.FRAGMENT_SHADER, fragmentShaderSource,
    )
  }

  return ShaderProgram
    .create(gl, vertexShader, fragmentShader)
    .addAttributes(vertAttributes);
}
