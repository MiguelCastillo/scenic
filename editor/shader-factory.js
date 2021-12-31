import {
  ShaderProgram,
  compileShaderSource,
} from "../src/shaders/program.js";

const shaderCache = {};

export function loadShaders(names) {
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
        addShaderCacheEntry(shaderName, vertexShaderSource, fragmentShaderSource);
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
    vertexShader = shaderCache[name].vertexShader = compileShaderSource(gl, gl.VERTEX_SHADER, vertexShaderSource);
  }

  if (!fragmentShader) {
    fragmentShader = shaderCache[name].fragmentShader = compileShaderSource(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  }

  return ShaderProgram
    .create(gl, vertexShader, fragmentShader)
    .addAttributes(vertAttributes);
}

// TODO(miguel): move this to the shader program compilation step!
function parseVertexShaderAttributes(vertexShaderSource) {
    // tester for regex to parse out attributes.
    // https://regex101.com/r/jmad0Z/1
    return [
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
}

export function addShaderCacheEntry(name, vertexShaderSource, fragmentShaderSource) {
  shaderCache[name] = {
    vertAttributes: parseVertexShaderAttributes(vertexShaderSource),
    vertexShaderSource,
    fragmentShaderSource,
  };
}
