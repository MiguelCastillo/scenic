import {ShaderProgram, compileShaderSource, parseVertexShaderAttributes} from "@scenic/renderer";

const shaderCache = {};

// Shaders that are being downloaded, by name, so that asking for a shader
// again while it downloads waits for the same download instead of starting
// another.
const pendingLoads = {};

// loadShaders loads shader sources into the cache so that createShaderProgram
// can create shader programs from them. Shaders are loaded when something is
// about to need them, such as a loader about to build a model, rather than all
// up front. A shader that is already cached is not loaded again.
// If you want to create a shader program in one step, use
// createShaderProgramAsync.
export function loadShaders(names) {
  return Promise.all(
    names
      .filter((shaderName) => !shaderCache[shaderName])
      .map((shaderName) => {
        if (!pendingLoads[shaderName]) {
          // File extensions for shaders aren't quite standard, however I have
          // chosen what is used here:
          // https://www.khronos.org/opengles/sdk/tools/Reference-Compiler/
          const vertexShaderPath = shaderName + ".vert";
          const fragmentShaderPath = shaderName + ".frag";

          pendingLoads[shaderName] = Promise.all([
            fetch(vertexShaderPath).then((resp) => resp.text()),
            fetch(fragmentShaderPath).then((resp) => resp.text()),
          ])
            .then(([vertexShaderSource, fragmentShaderSource]) => {
              addShaderCacheEntry(shaderName, vertexShaderSource, fragmentShaderSource);
            })
            .finally(() => {
              delete pendingLoads[shaderName];
            });
        }

        return pendingLoads[shaderName];
      })
  );
}

// createShaderProgramAsync will dynamically load shader sources, cache them,
// and create shader programs. Use this when you want to create shader programs
// without preloading their source.
export async function createShaderProgramAsync(gl, name) {
  await loadShaders([name]);
  return createShaderProgram(gl, name);
}

// createShaderProgram creates a shader program using already cached shader
// sources.
// Use this when you want to create a shader program from preloadeded shader
// sources via loadShaders.
export function createShaderProgram(gl, name) {
  if (!shaderCache[name]) {
    throw new Error(
      `shader program ${name} is not loaded. Please call loadShaders first and await for that to finish`
    );
  }

  let {vertexShaderSource, fragmentShaderSource, vertexShader, fragmentShader, attributes} =
    shaderCache[name];

  if (!vertexShader) {
    vertexShader = compileShaderSource(gl, gl.VERTEX_SHADER, vertexShaderSource);
    shaderCache[name].vertexShader = vertexShader;

    attributes = parseVertexShaderAttributes(vertexShaderSource);
    shaderCache[name].attributes = attributes;
  }

  if (!fragmentShader) {
    fragmentShader = compileShaderSource(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    shaderCache[name].fragmentShader = fragmentShader;
  }

  const shaderProgram = ShaderProgram.createWithCompiledShaders(gl, vertexShader, fragmentShader);

  if (attributes) {
    shaderProgram.addAttributes(attributes);
  }

  return shaderProgram;
}

// addShaderCacheEntry adds shader sources to the cache.
// You can use this method to preload the cache in tests. You can also use
// createShaderProgramAsync to accomplish that.
export function addShaderCacheEntry(name, vertexShaderSource, fragmentShaderSource) {
  shaderCache[name] = {
    vertexShaderSource,
    fragmentShaderSource,
  };
}
