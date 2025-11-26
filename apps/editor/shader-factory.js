import {ShaderProgram, compileShaderSource, parseVertexShaderAttributes} from "@scenic/renderer";

const shaderCache = {};

// loadShaders pre-emptively loads shader sources that can be used later to
// create shader programs. Before calling `createShaderProgram`, please call
// this method with the shaders sources you want to make available to
// create shader programs.  This two step dance allows us to load a while
// bunch of shader sources in cache first because creating shader programs
// on demand synchronously.
// If you want to be able to asynchrounousely create shader program without
// preloading shader sources, then use createShaderProgramAsync.
export function loadShaders(names) {
  const pendingShaders = names
    .filter((shaderName) => !shaderCache[shaderName])
    .map((shaderName) => {
      // File extensions for shaders aren't quite standard, however I have
      // chosen what is used here:
      // https://www.khronos.org/opengles/sdk/tools/Reference-Compiler/
      const vertexShaderPath = shaderName + ".vert";
      const fragmentShaderPath = shaderName + ".frag";

      return Promise.all([
        fetch(vertexShaderPath).then((resp) => resp.text()),
        fetch(fragmentShaderPath).then((resp) => resp.text()),
      ]).then(([vertexShaderSource, fragmentShaderSource]) => {
        addShaderCacheEntry(shaderName, vertexShaderSource, fragmentShaderSource);
      });
    });

  return Promise.all(pendingShaders);
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
